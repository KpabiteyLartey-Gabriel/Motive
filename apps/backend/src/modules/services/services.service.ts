import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProviderServiceDto, RequestServiceDto, UpdateProviderServiceDto, UpdateServiceRequestStatusDto } from './dto/services.dto';
import { NotificationsService } from '../notifications/notifications.service';

// Published provider services (detailing, oil change, tyre sales, towing…).
// Every signed-in user — owner, driver or plain user — browses them in
// Servicing, requests them for a vehicle, and the provider responds.
// Only the owning provider publishes and edits the listings themselves.
@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private shape(s: any) {
    const p = s.serviceProvider || {};
    return {
      id: s.id,
      title: s.title,
      category: s.category,
      description: s.description || null,
      priceGhs: s.priceGhs === null || s.priceGhs === undefined ? null : Number(s.priceGhs),
      priceNote: s.priceNote || null,
      durationMins: s.durationMins ?? null,
      isAvailable: s.isAvailable,
      provider: {
        id: p.id || s.serviceProviderId,
        businessName: p.businessName || null,
        serviceType: p.serviceType || null,
        phone: p.phone || null,
        city: p.city || null,
        region: p.region || null,
      },
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  async listPublic(query: { category?: string; q?: string } = {}) {
    const where: any = {
      isAvailable: true,
      serviceProvider: { status: 'ACTIVE' },
    };
    if (query.category) where.category = query.category;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { serviceProvider: { businessName: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const services = await this.prisma.providerService.findMany({
      where,
      include: { serviceProvider: { select: { id: true, businessName: true, serviceType: true, phone: true, city: true, region: true, status: true } } },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    return { services: services.map((s) => this.shape(s)), total: services.length };
  }

  private async requireProvider(userId: string) {
    const provider = await this.prisma.serviceProvider.findUnique({ where: { userId } }).catch(() => null);
    if (!provider) throw new ForbiddenException('You need a Service Provider account to publish services');
    if (provider.status !== 'ACTIVE') throw new ForbiddenException('Your Service Provider account is not active');
    return provider;
  }

  async listMine(userId: string) {
    const provider = await this.requireProvider(userId);
    const services = await this.prisma.providerService.findMany({
      where: { serviceProviderId: provider.id },
      include: { serviceProvider: true },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    return { services: services.map((s) => this.shape(s)), provider: { id: provider.id, businessName: provider.businessName } };
  }

  async create(userId: string, dto: CreateProviderServiceDto) {
    const provider = await this.requireProvider(userId);
    const created = await this.prisma.providerService.create({
      data: {
        serviceProviderId: provider.id,
        title: dto.title.trim(),
        category: dto.category,
        description: dto.description?.trim() || null,
        priceGhs: dto.priceGhs ?? null,
        priceNote: dto.priceNote?.trim() || null,
        durationMins: dto.durationMins ?? null,
      },
      include: { serviceProvider: true },
    });
    return this.shape(created);
  }

  async update(userId: string, id: string, dto: UpdateProviderServiceDto) {
    const provider = await this.requireProvider(userId);
    const existing = await this.prisma.providerService.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    if (existing.serviceProviderId !== provider.id) throw new ForbiddenException('You can only edit your own services');
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.priceGhs !== undefined) data.priceGhs = dto.priceGhs;
    if (dto.priceNote !== undefined) data.priceNote = dto.priceNote?.trim() || null;
    if (dto.durationMins !== undefined) data.durationMins = dto.durationMins;
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;
    const updated = await this.prisma.providerService.update({ where: { id }, data, include: { serviceProvider: true } });
    return this.shape(updated);
  }

  // ── Service requests ───────────────────────────────────────
  private shapeRequest(r: any, requester?: any) {
    const s = r.providerService || {};
    const p = s.serviceProvider || r.serviceProvider || {};
    return {
      id: r.id,
      status: r.status,
      vehicleId: r.vehicleId || null,
      vehicleLabel: r.vehicleLabel || null,
      preferredDate: r.preferredDate || null,
      contactPhone: r.contactPhone || null,
      notes: r.notes || null,
      providerNote: r.providerNote || null,
      createdAt: r.createdAt,
      service: { id: s.id || r.providerServiceId, title: s.title || null, category: s.category || null, priceGhs: s.priceGhs == null ? null : Number(s.priceGhs), priceNote: s.priceNote || null },
      provider: { businessName: p.businessName || null, phone: p.phone || null, city: p.city || null, region: p.region || null },
      ...(requester ? { requester } : {}),
    };
  }

  private async notify(userId: string, subject: string, body: string, email = false) {
    if (!this.notifications?.send) return;
    await this.notifications.send({ userId, channel: 'IN_APP' as any, type: 'SERVICE_REQUEST', subject, body, data: {} }).catch(() => null);
    if (email) await this.notifications.send({ userId, channel: 'EMAIL' as any, type: 'SERVICE_REQUEST', subject, body, data: {} }).catch(() => null);
  }

  async requestService(userId: string, serviceId: string, dto: RequestServiceDto) {
    const service = await this.prisma.providerService.findUnique({
      where: { id: serviceId },
      include: { serviceProvider: true },
    });
    if (!service || !service.isAvailable || service.serviceProvider.status !== 'ACTIVE') {
      throw new NotFoundException('This service is not available');
    }
    let vehicleLabel = dto.vehicleLabel?.trim() || null;
    if (dto.vehicleId) {
      const vehicle: any = await this.prisma.vehicle.findUnique({
        where: { id: dto.vehicleId },
        include: { contracts: { where: { status: 'ACTIVE' }, select: { parties: { where: { userId }, select: { id: true } } } } },
      }).catch(() => null);
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      const [owner, driver] = await Promise.all([
        this.prisma.owner.findUnique({ where: { userId } }).catch(() => null),
        (this.prisma as any).driver?.findUnique ? this.prisma.driver.findUnique({ where: { userId } }).catch(() => null) : null,
      ]);
      const linked =
        (owner && vehicle.ownerId === owner.id) ||
        (driver && vehicle.currentDriverId === driver.id) ||
        (vehicle.contracts || []).some((c: any) => (c.parties || []).length > 0);
      if (!linked) throw new ForbiddenException('That vehicle is not linked to you. Describe your vehicle instead.');
      vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}`;
    }
    if (!vehicleLabel) throw new BadRequestException('Choose one of your vehicles, or describe your vehicle.');
    let preferredDate: Date | null = null;
    if (dto.preferredDate) {
      preferredDate = new Date(dto.preferredDate);
      if (Number.isNaN(preferredDate.getTime())) throw new BadRequestException('Preferred date is not a valid date.');
    }
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, phone: true },
    }).catch(() => null);
    const created = await this.prisma.serviceRequest.create({
      data: {
        providerServiceId: service.id,
        serviceProviderId: service.serviceProviderId,
        requestedBy: userId,
        vehicleId: dto.vehicleId || null,
        vehicleLabel,
        preferredDate,
        contactPhone: dto.contactPhone?.trim() || requester?.phone || null,
        notes: dto.notes?.trim() || null,
      },
      include: { providerService: { include: { serviceProvider: true } } },
    });
    const requesterName = requester ? `${requester.firstName} ${requester.lastName}`.trim() : 'A +Motive user';
    await this.notify(
      service.serviceProvider.userId,
      `New service request — ${service.title}`,
      `${requesterName} requested "${service.title}" for ${vehicleLabel}${preferredDate ? `, preferred ${preferredDate.toISOString().slice(0, 10)}` : ''}. Open Servicing to accept or decline.`,
      true,
    );
    return this.shapeRequest(created);
  }

  async listMyRequests(userId: string) {
    const requests = await this.prisma.serviceRequest.findMany({
      where: { requestedBy: userId },
      include: { providerService: { include: { serviceProvider: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { requests: requests.map((r) => this.shapeRequest(r)) };
  }

  async listIncomingRequests(userId: string) {
    const provider = await this.requireProvider(userId);
    const requests = await this.prisma.serviceRequest.findMany({
      where: { serviceProviderId: provider.id },
      include: { providerService: { include: { serviceProvider: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const requesterIds = [...new Set(requests.map((r) => r.requestedBy))];
    const users = requesterIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, firstName: true, lastName: true, phone: true, chatUsername: true },
        }).catch(() => [])
      : [];
    const byId = new Map(users.map((u: any) => [u.id, {
      name: `${u.firstName} ${u.lastName}`.trim(), phone: u.phone || null, chatUsername: u.chatUsername || null,
    }]));
    return { requests: requests.map((r) => this.shapeRequest(r, byId.get(r.requestedBy) || null)) };
  }

  async updateRequestStatus(userId: string, requestId: string, dto: UpdateServiceRequestStatusDto) {
    const status = String(dto.status || '').toUpperCase();
    if (!['ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Status must be ACCEPTED, DECLINED, COMPLETED or CANCELLED.');
    }
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { providerService: { include: { serviceProvider: true } } },
    });
    if (!request) throw new NotFoundException('Service request not found');
    const isProvider = request.providerService.serviceProvider.userId === userId;
    const isRequester = request.requestedBy === userId;
    if (status === 'CANCELLED') {
      if (!isRequester) throw new ForbiddenException('Only the person who requested can cancel it');
    } else if (!isProvider) {
      throw new ForbiddenException('Only the provider can respond to this request');
    }
    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: status as any, ...(dto.providerNote !== undefined ? { providerNote: dto.providerNote?.trim() || null } : {}) },
      include: { providerService: { include: { serviceProvider: true } } },
    });
    if (isProvider) {
      await this.notify(
        request.requestedBy,
        `Service request ${status.toLowerCase()} — ${request.providerService.title}`,
        `${request.providerService.serviceProvider.businessName} ${status === 'COMPLETED' ? 'marked your request complete' : status.toLowerCase() + ' your request'} for "${request.providerService.title}" (${request.vehicleLabel}).${dto.providerNote ? ` Note: ${dto.providerNote}` : ''}`,
        status === 'ACCEPTED',
      );
    } else {
      await this.notify(request.providerService.serviceProvider.userId, `Service request cancelled — ${request.providerService.title}`, `The request for "${request.providerService.title}" (${request.vehicleLabel}) was cancelled by the requester.`);
    }
    return this.shapeRequest(updated);
  }

  async remove(userId: string, id: string) {
    const provider = await this.requireProvider(userId);
    const existing = await this.prisma.providerService.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    if (existing.serviceProviderId !== provider.id) throw new ForbiddenException('You can only remove your own services');
    await this.prisma.providerService.delete({ where: { id } });
    return { removed: true };
  }
}
