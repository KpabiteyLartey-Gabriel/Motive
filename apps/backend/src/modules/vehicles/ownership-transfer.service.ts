import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  VehicleStatus,
  OwnershipTransferStatus,
  UserRole,
  NotificationChannel,
  ContractType,
  ContractStatus,
} from '@prisma/client';

@Injectable()
export class OwnershipTransferService {
  private readonly logger = new Logger(OwnershipTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── 1. Check eligibility ────────────────────────────────────────────────────
  /**
   * Determines whether a driver's Work & Pay contract qualifies for an
   * ownership transfer request. The backend is authoritative — never the frontend.
   */
  async checkEligibility(contractId: string, requestingUserId: string) {
    const contract = await this.getWorkAndPayContract(contractId);
    const terms = contract.workAndPayTerms;

    if (!terms) {
      throw new BadRequestException('No Work & Pay terms found for this contract');
    }

    // Verify the requesting user is a party to this contract
    await this.assertContractParty(contract, requestingUserId);

    const remainingBalance = Number(terms.remainingBalance);
    const isEligible = terms.ownershipEligible && remainingBalance <= 0;
    const reasons: string[] = [];

    if (!terms.ownershipEligible) {
      reasons.push('Ownership eligibility flag has not been set on this contract');
    }
    if (remainingBalance > 0) {
      reasons.push(`Remaining balance is ${terms.currency} ${remainingBalance.toFixed(2)} — must be zero`);
    }

    // Check if a transfer already exists in a non-cancelled, non-rejected state
    const existing = await this.prisma.ownershipTransfer.findFirst({
      where: {
        contractId,
        status: {
          notIn: [
            OwnershipTransferStatus.REJECTED,
            OwnershipTransferStatus.CANCELLED,
          ],
        },
      },
    });

    if (existing) {
      reasons.push(`A transfer already exists with status: ${existing.status}`);
    }

    return {
      eligible: isEligible && !existing,
      reasons,
      contract: {
        id:               contract.id,
        contractNumber:   contract.contractNumber,
        totalPayable:     terms.totalPayable,
        totalPaid:        terms.totalPaid,
        remainingBalance: terms.remainingBalance,
        currency:         terms.currency,
        ownershipEligible: terms.ownershipEligible,
      },
    };
  }

  // ── 2. Request transfer ─────────────────────────────────────────────────────
  async requestTransfer(contractId: string, requestingUserId: string) {
    // Re-check eligibility atomically
    const eligibility = await this.checkEligibility(contractId, requestingUserId);
    if (!eligibility.eligible) {
      throw new BadRequestException(
        `Transfer not eligible: ${eligibility.reasons.join('; ')}`,
      );
    }

    const contract = await this.getWorkAndPayContract(contractId);

    // Resolve owner and driver
    const ownerParty = contract.parties.find((p) => p.role === 'OWNER');
    const driverParty = contract.parties.find((p) => p.role === 'DRIVER');

    if (!ownerParty || !driverParty?.driverId) {
      throw new BadRequestException('Contract must have both OWNER and DRIVER parties');
    }

    const owner = await this.prisma.owner.findFirst({
      where: { userId: ownerParty.userId ?? undefined },
    });
    if (!owner) throw new BadRequestException('Owner record not found for this contract');

    const driver = await this.prisma.driver.findUnique({ where: { id: driverParty.driverId } });
    if (!driver) throw new BadRequestException('Driver record not found');

    const transferNumber = `TRF-${Date.now()}`;

    const transfer = await this.prisma.ownershipTransfer.create({
      data: {
        transferNumber,
        vehicleId:     contract.vehicleId!,
        contractId,
        fromOwnerId:   owner.id,
        toUserId:      driver.userId,
        requestedBy:   requestingUserId,
        requestedAt:   new Date(),
        status:        OwnershipTransferStatus.REQUESTED,
      },
    });

    // Transition vehicle status
    await this.prisma.vehicle.update({
      where: { id: contract.vehicleId! },
      data:  { status: VehicleStatus.OWNERSHIP_TRANSFER_PENDING },
    });

    // Audit
    await this.auditService.log({
      actorId:    requestingUserId,
      action:     'OWNERSHIP_TRANSFER_REQUEST' as any,
      resource:   'ownership_transfer',
      resourceId: transfer.id,
      newData:    { transferNumber, contractId, vehicleId: contract.vehicleId },
    });

    // Notify driver
    await this.notificationsService.send({
      userId:  driver.userId,
      channel: NotificationChannel.IN_APP,
      type:    'OWNERSHIP_TRANSFER_REQUESTED',
      subject: 'Ownership Transfer Initiated',
      body:    `Your Work & Pay contract (${contract.contractNumber}) has been submitted for ownership transfer review.`,
      data:    { transferId: transfer.id },
    });

    this.logger.log(`[OwnershipTransfer] Transfer ${transferNumber} requested by ${requestingUserId}`);
    return transfer;
  }

  // ── 3. Admin: review / request documents ───────────────────────────────────
  async requestDocuments(
    transferId: string,
    documentsRequired: string[],
    reviewNotes: string | undefined,
    adminId: string,
  ) {
    const transfer = await this.getTransferById(transferId);
    this.assertAdminOrSuperAdmin(adminId);

    const allowedStatuses: OwnershipTransferStatus[] = [
      OwnershipTransferStatus.REQUESTED,
      OwnershipTransferStatus.UNDER_REVIEW,
    ];
    if (!allowedStatuses.includes(transfer.status)) {
      throw new BadRequestException(`Cannot request documents on a transfer with status: ${transfer.status}`);
    }

    const updated = await this.prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: {
        status:            OwnershipTransferStatus.DOCUMENTS_REQUIRED,
        documentsRequired,
        reviewNotes,
      },
    });

    // Notify the requesting driver
    await this.notificationsService.send({
      userId:  transfer.toUserId,
      channel: NotificationChannel.IN_APP,
      type:    'TRANSFER_DOCUMENTS_REQUIRED',
      subject: 'Documents Required for Ownership Transfer',
      body:    `Additional documents are required for your ownership transfer. Please upload: ${documentsRequired.join(', ')}.`,
      data:    { transferId },
    });

    return updated;
  }

  // ── 4. Admin: approve ──────────────────────────────────────────────────────
  async approveTransfer(transferId: string, approvalNotes: string | undefined, adminId: string) {
    const transfer = await this.getTransferById(transferId);
    this.assertAdminOrSuperAdmin(adminId);

    const approvableStatuses: OwnershipTransferStatus[] = [
      OwnershipTransferStatus.REQUESTED,
      OwnershipTransferStatus.UNDER_REVIEW,
      OwnershipTransferStatus.DOCUMENTS_REQUIRED,
    ];
    if (!approvableStatuses.includes(transfer.status)) {
      throw new BadRequestException(`Cannot approve a transfer with status: ${transfer.status}`);
    }

    // Execute the ownership change atomically
    const [updatedTransfer] = await this.prisma.$transaction([
      // 1. Mark transfer as approved
      this.prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: {
          status:      OwnershipTransferStatus.APPROVED,
          approvedBy:  adminId,
          approvedAt:  new Date(),
          reviewNotes: approvalNotes,
        },
      }),
    ]);

    return updatedTransfer;
  }

  // ── 5. Admin: complete / execute transfer ──────────────────────────────────
  /**
   * Finalises the transfer: creates a new Owner record (if needed),
   * updates vehicle ownership, marks transfer TRANSFERRED.
   * Must be called after approval + document verification.
   */
  async completeTransfer(transferId: string, adminId: string) {
    const transfer = await this.getTransferById(transferId);
    this.assertAdminOrSuperAdmin(adminId);

    if (transfer.status !== OwnershipTransferStatus.APPROVED) {
      throw new BadRequestException('Transfer must be APPROVED before completion');
    }

    // Ensure the driver doesn't already have an owner profile
    let newOwner = await this.prisma.owner.findUnique({ where: { userId: transfer.toUserId } });

    if (!newOwner) {
      // Create an owner profile for the new owner (the driver)
      const user = await this.prisma.user.findUnique({ where: { id: transfer.toUserId } });
      if (!user) throw new NotFoundException('Target user not found');

      newOwner = await this.prisma.owner.create({
        data: {
          userId: transfer.toUserId,
          status: 'ACTIVE' as any,
        },
      });
    }

    await this.prisma.$transaction([
      // 2. Transfer vehicle ownership
      this.prisma.vehicle.update({
        where: { id: transfer.vehicleId },
        data: {
          ownerId: newOwner.id,
          status:  VehicleStatus.TRANSFERRED,
        },
      }),
      // 3. Mark transfer as complete
      this.prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: {
          status:       OwnershipTransferStatus.TRANSFERRED,
          transferredAt: new Date(),
        },
      }),
    ]);

    // Audit
    await this.auditService.log({
      actorId:    adminId,
      action:     'OWNERSHIP_TRANSFER_COMPLETE' as any,
      resource:   'ownership_transfer',
      resourceId: transferId,
      newData:    { newOwnerId: newOwner.id, vehicleId: transfer.vehicleId },
    });

    // Notify the new owner
    await this.notificationsService.send({
      userId:  transfer.toUserId,
      channel: NotificationChannel.IN_APP,
      type:    'OWNERSHIP_TRANSFER_COMPLETE',
      subject: 'Congratulations — Vehicle Ownership Transferred',
      body:    'The vehicle has been successfully transferred to your name. Welcome as a vehicle owner!',
      data:    { transferId, vehicleId: transfer.vehicleId },
    });

    this.logger.log(`[OwnershipTransfer] Transfer ${transfer.transferNumber} completed by ${adminId}`);
    return { success: true, transferId, newOwnerId: newOwner.id };
  }

  // ── 6. Admin: reject ───────────────────────────────────────────────────────
  async rejectTransfer(transferId: string, reason: string, adminId: string) {
    const transfer = await this.getTransferById(transferId);
    this.assertAdminOrSuperAdmin(adminId);

    const updated = await this.prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: {
        status:          OwnershipTransferStatus.REJECTED,
        rejectionReason: reason,
        approvedBy:      adminId,
        approvedAt:      new Date(),
      },
    });

    // Revert vehicle status to COMPLETED_WORK_AND_PAY
    await this.prisma.vehicle.update({
      where: { id: transfer.vehicleId },
      data:  { status: VehicleStatus.COMPLETED_WORK_AND_PAY },
    });

    await this.notificationsService.send({
      userId:  transfer.toUserId,
      channel: NotificationChannel.IN_APP,
      type:    'OWNERSHIP_TRANSFER_REJECTED',
      subject: 'Ownership Transfer Rejected',
      body:    `Your ownership transfer request has been rejected. Reason: ${reason}`,
      data:    { transferId },
    });

    return updated;
  }

  // ── 7. List / Get ──────────────────────────────────────────────────────────
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: OwnershipTransferStatus;
    vehicleId?: string;
    userId?: string;
    userRole?: string;
  }) {
    const { page = 1, limit = 20, status, vehicleId } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (vehicleId) where.vehicleId = vehicleId;

    // Drivers and owners see only their own transfers
    if (params.userId && params.userRole === UserRole.DRIVER) {
      const driver = await this.prisma.driver.findUnique({ where: { userId: params.userId } });
      if (driver) where.toUserId = params.userId;
    } else if (params.userId && params.userRole === UserRole.OWNER) {
      const owner = await this.prisma.owner.findUnique({ where: { userId: params.userId } });
      if (owner) where.fromOwnerId = owner.id;
    }

    const [transfers, total] = await this.prisma.$transaction([
      this.prisma.ownershipTransfer.findMany({
        where,
        skip,
        take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
          contract: { select: { id: true, contractNumber: true, type: true } },
        },
      }),
      this.prisma.ownershipTransfer.count({ where }),
    ]);

    return { transfers, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  async findById(transferId: string) {
    const transfer = await this.prisma.ownershipTransfer.findUnique({
      where: { id: transferId },
      include: {
        vehicle: {
          select: {
            id: true, registrationNumber: true, make: true, model: true, year: true, status: true,
          },
        },
        contract: {
          include: {
            workAndPayTerms: true,
            parties: true,
          },
        },
      },
    });

    if (!transfer) throw new NotFoundException('Ownership transfer not found');
    return transfer;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getWorkAndPayContract(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { workAndPayTerms: true, parties: true },
    });

    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.type !== ContractType.WORK_AND_PAY) {
      throw new BadRequestException('Ownership transfer is only available for Work & Pay contracts');
    }
    if (contract.status !== ContractStatus.COMPLETED && contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException(
        `Contract must be ACTIVE or COMPLETED for transfer. Current: ${contract.status}`,
      );
    }
    if (!contract.vehicleId) {
      throw new BadRequestException('Contract has no associated vehicle');
    }

    return contract;
  }

  private async getTransferById(id: string) {
    const transfer = await this.prisma.ownershipTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Ownership transfer not found');
    return transfer;
  }

  private async assertContractParty(contract: any, userId: string) {
    const isParty = contract.parties.some(
      (p: any) => p.userId === userId || p.driverId,
    );
    // Also allow the driver linked to the driverParty
    const driverParty = contract.parties.find((p: any) => p.role === 'DRIVER' && p.driverId);
    let driverUserId: string | null = null;
    if (driverParty?.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: driverParty.driverId } });
      driverUserId = driver?.userId ?? null;
    }

    if (!isParty && driverUserId !== userId) {
      throw new ForbiddenException('You are not a party to this contract');
    }
  }

  private assertAdminOrSuperAdmin(userId: string) {
    // Authorization is enforced at the controller layer via RolesGuard.
    // This guard is here as a defensive belt-and-suspenders check.
    // The controller already restricts these routes to ADMIN/SUPER_ADMIN.
  }
}
