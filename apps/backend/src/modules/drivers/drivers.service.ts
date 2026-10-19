import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { StorageService } from '../storage/storage.service';
import { Optional } from '@nestjs/common';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  async createProfile(userId: string, dto: CreateDriverProfileDto) {
    const existing = await this.prisma.driver.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Driver profile already exists for this user');
    }

    if (dto.licenseNumber) {
      const licenseExists = await this.prisma.driver.findUnique({
        where: { licenseNumber: dto.licenseNumber },
      });
      if (licenseExists) {
        throw new ConflictException('License number is already registered');
      }
    }

    return this.prisma.driver.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  // KYC: driver submits licence + identity details for admin review.
  // Verification status itself can only be changed by an admin.
  async updateProfile(userId: string, dto: UpdateDriverProfileDto) {
    const data: any = {};
    for (const key of ['licenseNumber', 'licenseClass', 'identityDocType', 'identityDocNumber', 'ghanaCardNumber', 'address', 'city', 'region'] as const) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    if (dto.licenseExpiryDate !== undefined) {
      data.licenseExpiryDate = dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : null;
    }
    if (dto.emergencyContactName !== undefined || dto.emergencyContactPhone !== undefined || dto.emergencyContactRelationship !== undefined) {
      data.emergencyContact = {
        name: dto.emergencyContactName || '',
        phone: dto.emergencyContactPhone || '',
        relationship: dto.emergencyContactRelationship || '',
      };
    }

    const existing = await this.prisma.driver.findUnique({ where: { userId } });
    if (!existing) {
      if (data.licenseNumber) await this.assertLicenseAvailable(data.licenseNumber);
      await this.prisma.driver.create({ data: { userId, ...data } });
      return this.getProfile(userId);
    }

    if (data.licenseNumber && data.licenseNumber !== existing.licenseNumber) {
      await this.assertLicenseAvailable(data.licenseNumber, existing.id);
    }
    await this.prisma.driver.update({ where: { userId }, data });
    return this.getProfile(userId);
  }

  private async assertLicenseAvailable(licenseNumber: string, exceptDriverId?: string) {
    const found = await this.prisma.driver.findUnique({ where: { licenseNumber } });
    if (found && found.id !== exceptDriverId) {
      throw new ConflictException('License number is already registered to another driver');
    }
  }

  async addDocument(userId: string, file: any, type: string, expiryDate?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found — save your licence details first');
    if (!this.storage) throw new ConflictException('Document storage is not available right now');

    const allowed = ['LICENSE', 'GHANA_CARD', 'PASSPORT', 'OTHER'];
    const docType = allowed.includes((type || '').toUpperCase()) ? type.toUpperCase() : 'OTHER';
    const stored = await this.storage.uploadFile(file, `drivers/${driver.id}/documents`);

    return this.prisma.driverDocument.create({
      data: {
        driverId: driver.id,
        type: docType,
        fileUrl: stored.url,
        fileName: file.originalname || 'document',
        fileSize: file.size || null,
        mimeType: file.mimetype || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });
  }

  async getProfile(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profilePhotoUrl: true,
          },
        },
        documents: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return driver;
  }

  async getDriverById(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profilePhotoUrl: true,
          },
        },
        documents: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20, search } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));

    const where: any = {};

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { licenseNumber: { contains: search } },
      ];
    }

    const [drivers, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        skip,
        take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return {
      drivers,
      pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) },
    };
  }

  async authorizeDriverAccess(driverId: string, requestingUserId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { userId: true },
    });

    if (!driver) throw new NotFoundException('Driver not found');

    if (driver.userId !== requestingUserId) {
      // Check if admin
      const user = await this.prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { primaryRole: true },
      });
      if (!['ADMIN', 'SUPER_ADMIN'].includes(user?.primaryRole)) {
        throw new ForbiddenException('Access denied to this driver record');
      }
    }
  }
}
