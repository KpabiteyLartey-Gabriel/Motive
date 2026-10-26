import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, VehicleStatus, VehicleVerificationStatus, VehicleInterestStatus, ContractAccessCodeStatus } from '@prisma/client';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  static hashCode(code: string): string {
    return createHash('sha256').update(String(code).trim()).digest('hex');
  }

  /** Chat usernames are stored lowercase, without the @. */
  static normalizeChatUsername(raw: string): string {
    return String(raw || '').trim().replace(/^@+/, '').toLowerCase();
  }

  static assertValidChatUsername(username: string) {
    if (!/^[a-z0-9][a-z0-9._]{2,19}$/.test(username) || username.includes('..')) {
      throw new BadRequestException('Choose a username of 3-20 characters: lowercase letters, numbers, dots or underscores, starting with a letter or number.');
    }
  }

  // ── Chat username (created on first visit to Chat) ─────────
  async getChatUsername(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, chatUsername: true, primaryRole: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return { chatUsername: user.chatUsername || null, hasChatUsername: !!user.chatUsername, user };
  }

  async setChatUsername(userId: string, raw: string) {
    const chatUsername = MarketplaceService.normalizeChatUsername(raw);
    MarketplaceService.assertValidChatUsername(chatUsername);
    const taken = await this.prisma.user.findFirst({
      where: { chatUsername, id: { not: userId } },
      select: { id: true },
    });
    if (taken) throw new ConflictException(`@${chatUsername} is already taken. Try another username.`);
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { chatUsername },
        select: { id: true, firstName: true, lastName: true, chatUsername: true, primaryRole: true },
      });
      return { chatUsername: user.chatUsername, hasChatUsername: true, user };
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException(`@${chatUsername} is already taken. Try another username.`);
      throw e;
    }
  }

  /**
   * Every account a person holds, for chat profiles: a user may be a Driver
   * and an Owner and a Service Provider and belong to companies at once.
   * Only public identity facts — never phone, email or ID numbers.
   */
  static chatAccounts(u: any) {
    const accounts: any[] = [];
    if (u.driver) {
      accounts.push({
        type: 'DRIVER', label: 'Driver', status: u.driver.status || null,
        verified: !!(u.driver.nationalIdVerifiedAt || ['VERIFIED', 'ACTIVE'].includes(u.driver.status)),
      });
    }
    if (u.owner) {
      accounts.push({
        type: 'OWNER', label: 'Vehicle Owner', status: u.owner.status || null,
        verified: !!(u.owner.nationalIdVerifiedAt || u.owner.status === 'VERIFIED'),
      });
    }
    if (u.serviceProvider) {
      accounts.push({
        type: 'SERVICE_PROVIDER', label: u.serviceProvider.businessName || 'Service Provider',
        detail: u.serviceProvider.serviceType || null, status: u.serviceProvider.status || null,
      });
    }
    for (const m of u.companyMembers || []) {
      if (m.isActive === false) continue;
      accounts.push({
        type: 'COMPANY', label: m.company?.name || 'Company',
        detail: m.title || null, role: m.role || null,
      });
    }
    if (!accounts.length) {
      const role = String(u.primaryRole || 'PENDING');
      accounts.push({ type: role, label: role === 'PENDING' ? 'User' : role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) });
    }
    return accounts;
  }

  private chatProfileSelect = {
    id: true, firstName: true, lastName: true, chatUsername: true, primaryRole: true, profilePhotoUrl: true,
    driver: { select: { id: true, status: true, nationalIdVerifiedAt: true, licenceVerifiedAt: true } },
    owner: { select: { id: true, status: true, nationalIdVerifiedAt: true } },
    serviceProvider: { select: { id: true, businessName: true, serviceType: true, status: true } },
    companyMembers: {
      where: { isActive: true },
      select: { id: true, role: true, title: true, isActive: true, company: { select: { id: true, name: true } } },
    },
  } as const;

  /** Find people by chat username, with their profile and all their accounts. */
  async searchChatUsers(userId: string, query: string) {
    const q = MarketplaceService.normalizeChatUsername(query || '');
    if (q.length < 2) return [];
    const users = await this.prisma.user.findMany({
      where: { chatUsername: { contains: q, mode: 'insensitive' }, id: { not: userId } },
      select: this.chatProfileSelect,
      take: 10,
      orderBy: { chatUsername: 'asc' },
    });
    return users.map((u: any) => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName, chatUsername: u.chatUsername,
      primaryRole: u.primaryRole, profilePhotoUrl: u.profilePhotoUrl,
      isDriver: !!u.driver, isOwner: !!u.owner,
      accounts: MarketplaceService.chatAccounts(u),
    }));
  }

  /** Open (or reuse) a direct chat with a person found by username. */
  async startDirectThread(userId: string, rawUsername: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, chatUsername: true } });
    if (!me?.chatUsername) throw new BadRequestException('Create your chat username first, then you can message people by username.');
    const chatUsername = MarketplaceService.normalizeChatUsername(rawUsername);
    const target = await this.prisma.user.findUnique({
      where: { chatUsername },
      select: { id: true, firstName: true, lastName: true, chatUsername: true, primaryRole: true },
    });
    if (!target) throw new NotFoundException(`No user found with username @${chatUsername}. Check the spelling and try again.`);
    if (target.id === userId) throw new BadRequestException('That is your own username.');
    const existing = await this.prisma.chatThread.findFirst({
      where: {
        interestId: null, contractId: null,
        OR: [
          { ownerUserId: userId, driverUserId: target.id },
          { ownerUserId: target.id, driverUserId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return { thread: existing, otherParty: target, created: false };
    const targetDriver = await this.prisma.driver.findUnique({ where: { userId: target.id }, select: { id: true } });
    const myDriver = targetDriver ? null : await this.prisma.driver.findUnique({ where: { userId }, select: { id: true } });
    const thread = await this.prisma.chatThread.create({
      data: {
        vehicleId: null, interestId: null, contractId: null,
        ownerUserId: targetDriver || !myDriver ? userId : target.id,
        driverUserId: targetDriver || !myDriver ? target.id : userId,
      },
    });
    return { thread, otherParty: target, created: true };
  }

  private async notify(userId: string | null | undefined, type: string, subject: string, body: string, data: any) {
    if (!userId) return;
    try {
      await this.prisma.notification.create({
        data: { userId, channel: 'IN_APP', type, subject, body, data, status: 'SENT', sentAt: new Date() },
      });
    } catch { /* notifications are best effort */ }
  }

  /** The user on the owner side who chats for this vehicle (owner, else a company admin of the managing company). */
  private async ownerSideUserId(vehicle: any): Promise<string | null> {
    if (vehicle.ownerId) {
      const owner = await this.prisma.owner.findUnique({ where: { id: vehicle.ownerId } });
      if (owner?.userId) return owner.userId;
    }
    if (vehicle.managingCompanyId) {
      const member = await this.prisma.companyMember.findFirst({
        where: { companyId: vehicle.managingCompanyId, isActive: true },
      });
      if (member?.userId) return member.userId;
    }
    return null;
  }

  private async assertVehicleSide(vehicle: any, userId: string, userRole: string) {
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) return;
    const ownerUserId = await this.ownerSideUserId(vehicle);
    if (ownerUserId === userId) return;
    if (vehicle.managingCompanyId) {
      const member = await this.prisma.companyMember.findFirst({ where: { companyId: vehicle.managingCompanyId, userId, isActive: true } });
      if (member) return;
    }
    throw new ForbiddenException('Access denied to this vehicle');
  }

  private vehicleCardInclude = {
    owner: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    managingCompany: { select: { id: true, name: true } },
  } as const;

  private async shapeVehicle(v: any, myDriverId?: string | null) {
    const [interestCount, myInterest] = await Promise.all([
      this.prisma.vehicleInterest.count({ where: { vehicleId: v.id, status: { in: [VehicleInterestStatus.PENDING, VehicleInterestStatus.APPROVED] } } }),
      myDriverId
        ? this.prisma.vehicleInterest.findUnique({ where: { vehicleId_driverId: { vehicleId: v.id, driverId: myDriverId } } })
        : Promise.resolve(null),
    ]);
    let myThreadId: string | null = null;
    if (myInterest) {
      const thread = await this.prisma.chatThread.findUnique({ where: { interestId: myInterest.id } });
      myThreadId = thread?.id || null;
    }
    return { ...v, interestCount, myInterestStatus: myInterest?.status || null, myInterestId: myInterest?.id || null, myThreadId };
  }

  // ── Explore ────────────────────────────────────────────────
  async explore(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        status: VehicleStatus.AVAILABLE,
        verificationStatus: VehicleVerificationStatus.APPROVED,
        interests: { none: { status: VehicleInterestStatus.APPROVED } },
      },
      orderBy: { updatedAt: 'desc' },
      include: this.vehicleCardInclude,
      take: 100,
    });
    return Promise.all(vehicles.map((v) => this.shapeVehicle(v, driver?.id)));
  }

  // ── Interest ───────────────────────────────────────────────
  async expressInterest(userId: string, vehicleId: string, message?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new ForbiddenException('Only drivers can show interest in vehicles');
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.status !== VehicleStatus.AVAILABLE || vehicle.verificationStatus !== VehicleVerificationStatus.APPROVED) {
      throw new BadRequestException('This vehicle is no longer available on Explore');
    }
    const chosen = await this.prisma.vehicleInterest.findFirst({ where: { vehicleId, status: VehicleInterestStatus.APPROVED } });
    if (chosen) throw new BadRequestException('The owner has already chosen a driver for this vehicle');

    const existing = await this.prisma.vehicleInterest.findUnique({ where: { vehicleId_driverId: { vehicleId, driverId: driver.id } } });
    if (existing) {
      if (existing.status === VehicleInterestStatus.DECLINED) {
        throw new ConflictException('The owner has already declined your interest in this vehicle');
      }
      if (existing.status === VehicleInterestStatus.RELEASED) {
        const interest = await this.prisma.vehicleInterest.update({
          where: { id: existing.id },
          data: { status: VehicleInterestStatus.PENDING, message: message || existing.message, decidedAt: null, decidedById: null },
        });
        const thread = await this.prisma.chatThread.findUnique({ where: { interestId: interest.id } });
        return { interest, thread };
      }
      const thread = await this.prisma.chatThread.findUnique({ where: { interestId: existing.id } });
      return { interest: existing, thread };
    }

    const ownerUserId = await this.ownerSideUserId(vehicle);
    if (!ownerUserId) throw new BadRequestException('This vehicle has no owner to contact');

    const { interest, thread } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vehicleInterest.create({
        data: { vehicleId, driverId: driver.id, driverUserId: userId, message: message || null },
      });
      const thread = await tx.chatThread.create({
        data: { vehicleId, interestId: created.id, ownerUserId, driverUserId: userId },
      });
      return { interest: created, thread };
    });

    await this.notify(ownerUserId, 'VEHICLE_INTEREST', 'A driver is interested in your vehicle',
      `A driver has shown interest in your ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}). Open Messages to chat with them.`,
      { vehicleId, interestId: interest.id, threadId: thread.id });
    if (message) {
      await this.prisma.chatMessage.create({ data: { threadId: thread.id, senderUserId: userId, body: message } });
      await this.prisma.chatThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date() } });
    }
    return { interest, thread };
  }

  async vehicleInterests(userId: string, userRole: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    await this.assertVehicleSide(vehicle, userId, userRole);
    const interests = await this.prisma.vehicleInterest.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'asc' },
      include: { driver: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: interests.map((i) => i.driverUserId) } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, profilePhotoUrl: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const threads = await this.prisma.chatThread.findMany({ where: { vehicleId } });
    const threadByInterest = new Map(threads.map((t) => [t.interestId, t.id]));
    return interests.map((i) => ({ ...i, driverUser: byId.get(i.driverUserId) || null, threadId: threadByInterest.get(i.id) || null }));
  }

  async myInterests(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) return [];
    const interests = await this.prisma.vehicleInterest.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
      include: { vehicle: { include: this.vehicleCardInclude } },
    });
    const threads = await this.prisma.chatThread.findMany({ where: { driverUserId: userId } });
    const threadByInterest = new Map(threads.map((t) => [t.interestId, t.id]));
    return interests.map((i) => ({ ...i, threadId: threadByInterest.get(i.id) || null }));
  }

  private async loadInterestForOwner(userId: string, userRole: string, interestId: string) {
    const interest = await this.prisma.vehicleInterest.findUnique({ where: { id: interestId } });
    if (!interest) throw new NotFoundException('Interest not found');
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: interest.vehicleId } });
    await this.assertVehicleSide(vehicle, userId, userRole);
    return { interest, vehicle };
  }

  async approveInterest(userId: string, userRole: string, interestId: string) {
    const { interest, vehicle } = await this.loadInterestForOwner(userId, userRole, interestId);
    if (interest.status === VehicleInterestStatus.APPROVED) return interest;
    if (interest.status !== VehicleInterestStatus.PENDING) throw new BadRequestException('This interest can no longer be approved');
    const already = await this.prisma.vehicleInterest.findFirst({ where: { vehicleId: interest.vehicleId, status: VehicleInterestStatus.APPROVED } });
    if (already && already.id !== interest.id) throw new ConflictException('Another driver has already been approved for this vehicle. Release them first.');

    const updated = await this.prisma.vehicleInterest.update({
      where: { id: interestId },
      data: { status: VehicleInterestStatus.APPROVED, decidedAt: new Date(), decidedById: userId },
    });
    const thread = await this.prisma.chatThread.findUnique({ where: { interestId } });
    if (thread) {
      await this.prisma.chatMessage.create({
        data: { threadId: thread.id, senderUserId: userId, body: `Good news — I have approved you for the ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}). I will prepare the contract and send you your access code here.` },
      });
      await this.prisma.chatThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date() } });
    }
    await this.notify(interest.driverUserId, 'INTEREST_APPROVED', 'You have been approved for a vehicle',
      `The owner approved your interest in the ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}). Check your messages — your contract access code will arrive there.`,
      { vehicleId: vehicle.id, interestId, threadId: thread?.id });
    return updated;
  }

  async declineInterest(userId: string, userRole: string, interestId: string) {
    const { interest } = await this.loadInterestForOwner(userId, userRole, interestId);
    if (interest.status !== VehicleInterestStatus.PENDING) throw new BadRequestException('This interest can no longer be declined');
    const updated = await this.prisma.vehicleInterest.update({
      where: { id: interestId },
      data: { status: VehicleInterestStatus.DECLINED, decidedAt: new Date(), decidedById: userId },
    });
    await this.notify(interest.driverUserId, 'INTEREST_DECLINED', 'Update on a vehicle you were interested in',
      'The owner chose not to proceed with your interest on this occasion. Keep exploring — new verified vehicles are added regularly.',
      { vehicleId: interest.vehicleId, interestId });
    return updated;
  }

  async releaseInterest(userId: string, userRole: string, interestId: string) {
    const { interest, vehicle } = await this.loadInterestForOwner(userId, userRole, interestId);
    if (interest.status !== VehicleInterestStatus.APPROVED) throw new BadRequestException('Only an approved driver can be released');
    const updated = await this.prisma.vehicleInterest.update({
      where: { id: interestId },
      data: { status: VehicleInterestStatus.RELEASED, decidedAt: new Date(), decidedById: userId },
    });
    await this.prisma.contractAccessCode.updateMany({
      where: { vehicleId: interest.vehicleId, driverUserId: interest.driverUserId, status: ContractAccessCodeStatus.ACTIVE },
      data: { status: ContractAccessCodeStatus.REVOKED },
    });
    await this.notify(interest.driverUserId, 'INTEREST_RELEASED', 'A vehicle approval was released',
      `The owner released the approval for the ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}), so it is back on Explore.`,
      { vehicleId: interest.vehicleId, interestId });
    return updated;
  }

  // ── Chat ───────────────────────────────────────────────────
  async myThreads(userId: string) {
    const threads = await this.prisma.chatThread.findMany({
      where: { OR: [{ ownerUserId: userId }, { driverUserId: userId }] },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        vehicle: { select: { id: true, registrationNumber: true, make: true, model: true, year: true, imageUrls: true, operatingModel: true } },
        interest: { select: { id: true, status: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const otherIds: string[] = [...new Set(threads.map((t) => (t.ownerUserId === userId ? t.driverUserId : t.ownerUserId)))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: this.chatProfileSelect,
    });
    const byId = new Map(users.map((u: any) => [u.id, { ...u, accounts: MarketplaceService.chatAccounts(u) }]));
    const unreadCounts = await this.prisma.chatMessage.groupBy({
      by: ['threadId'],
      where: { threadId: { in: threads.map((t) => t.id) }, senderUserId: { not: userId }, readAt: null },
      _count: { id: true },
    });
    const unreadByThread = new Map(unreadCounts.map((c) => [c.threadId, c._count.id]));
    return threads.map((t) => ({
      ...t,
      otherParty: byId.get(t.ownerUserId === userId ? t.driverUserId : t.ownerUserId) || null,
      lastMessage: t.messages?.[0] || null,
      unreadCount: unreadByThread.get(t.id) || 0,
      messages: undefined,
    }));
  }

  private async assertThreadParticipant(userId: string, threadId: string) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Conversation not found');
    if (thread.ownerUserId !== userId && thread.driverUserId !== userId) {
      throw new ForbiddenException('Access denied to this conversation');
    }
    return thread;
  }

  async listMessages(userId: string, threadId: string) {
    const thread = await this.assertThreadParticipant(userId, threadId);
    await this.prisma.chatMessage.updateMany({
      where: { threadId, senderUserId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    const messages = await this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return { thread, messages };
  }

  async sendMessage(userId: string, threadId: string, dto: { body?: string; attachmentUrl?: string; attachmentName?: string }) {
    const me = typeof this.prisma.user.findUnique === 'function'
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { chatUsername: true } })
      : null;
    if (me && !me.chatUsername) {
      throw new BadRequestException('Create your chat username first — open Chat and choose your unique username before sending messages.');
    }
    const thread = await this.assertThreadParticipant(userId, threadId);
    const body = dto.body?.trim() || null;
    if (!body && !dto.attachmentUrl) throw new BadRequestException('Write a message or attach a document');
    const message = await this.prisma.chatMessage.create({
      data: { threadId, senderUserId: userId, body, attachmentUrl: dto.attachmentUrl || null, attachmentName: dto.attachmentName || null },
    });
    await this.prisma.chatThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date() } });
    const otherUserId = thread.ownerUserId === userId ? thread.driverUserId : thread.ownerUserId;
    const vehicle = thread.vehicleId ? await this.prisma.vehicle.findUnique({ where: { id: thread.vehicleId } }) : null;
    await this.notify(otherUserId, 'CHAT_MESSAGE', `New message about ${vehicle?.registrationNumber || 'a vehicle'}`,
      body ? body.slice(0, 160) : 'You received a document in your chat.',
      { vehicleId: thread.vehicleId, threadId, messageId: message.id });
    return message;
  }

  // ── Contract access codes ──────────────────────────────────
  async generateAccessCode(userId: string, contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!contract.vehicleId) throw new BadRequestException('This contract has no vehicle. Create the contract for the vehicle first.');
    const isCreatorSide = contract.createdBy === userId || contract.parties.some((p) => p.userId === userId && p.role !== UserRole.DRIVER);
    if (!isCreatorSide) throw new ForbiddenException('Only the contract owner side can generate the access code');
    const driverParty = contract.parties.find((p) => p.role === UserRole.DRIVER && p.userId);
    if (!driverParty?.userId) throw new BadRequestException('This contract has no driver yet. Add the approved driver to the contract first.');

    const interest = await this.prisma.vehicleInterest.findFirst({
      where: { vehicleId: contract.vehicleId, driverUserId: driverParty.userId, status: VehicleInterestStatus.APPROVED },
    });
    // Direct contracts (agreed in person, shared by chat username) do not
    // depend on Explore approval: the shared contract thread/card for this
    // driver is their approval record.
    const directThread = !interest && typeof this.prisma.chatThread?.findFirst === 'function'
      ? await this.prisma.chatThread.findFirst({ where: { contractId, driverUserId: driverParty.userId } })
      : null;
    const directCard = !interest && !directThread && typeof this.prisma.chatMessage?.findFirst === 'function'
      ? await this.prisma.chatMessage.findFirst({ where: { contractId, kind: 'CONTRACT' } })
      : null;
    if (!interest && !directThread && !directCard) {
      throw new BadRequestException('Access codes can only be generated for a driver you approved on Explore for this vehicle, or one you shared this contract with directly by chat username.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.contractAccessCode.updateMany({
      where: { contractId, status: ContractAccessCodeStatus.ACTIVE },
      data: { status: ContractAccessCodeStatus.REVOKED },
    });
    const record = await this.prisma.contractAccessCode.create({
      data: { contractId, vehicleId: contract.vehicleId, driverUserId: driverParty.userId, codeHash: MarketplaceService.hashCode(code), createdById: userId },
    });
    const thread = interest
      ? await this.prisma.chatThread.findUnique({ where: { interestId: interest.id } })
      : directThread;
    // The code itself is returned once to the owner to share in chat.
    return { code, accessCodeId: record.id, contractId, vehicleId: contract.vehicleId, driverUserId: driverParty.userId, threadId: thread?.id || null };
  }
}
