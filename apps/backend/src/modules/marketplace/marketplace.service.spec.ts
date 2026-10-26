import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService (Explore, interest, chat, codes)', () => {
  const vehicle: any = {
    id: 'veh-1', ownerId: 'owner-1', managingCompanyId: null, status: 'AVAILABLE',
    verificationStatus: 'APPROVED', operatingModel: 'WORK_AND_PAY',
    registrationNumber: 'GR-1-26', make: 'Toyota', model: 'Corolla', year: 2020,
  };
  const driver: any = { id: 'driver-1', userId: 'driver-user' };

  function makeSvc(overrides: any = {}) {
    const prisma: any = {
      driver: { findUnique: jest.fn().mockResolvedValue(driver) },
      owner: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-1', userId: 'owner-user' }) },
      companyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { create: jest.fn().mockResolvedValue({}) },
      vehicle: { findUnique: jest.fn().mockResolvedValue(vehicle), findMany: jest.fn().mockResolvedValue([vehicle]) },
      vehicleInterest: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'int-1', status: 'PENDING', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'int-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(2),
      },
      chatThread: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'thread-1', ...data })),
        findUnique: jest.fn().mockResolvedValue({ id: 'thread-1', interestId: 'int-1', ownerUserId: 'owner-user', driverUserId: 'driver-user', vehicleId: 'veh-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      chatMessage: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'msg-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      contract: { findUnique: jest.fn().mockResolvedValue(null) },
      contractAccessCode: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'code-1', ...data })),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      ...overrides,
    };
    return { svc: new MarketplaceService(prisma), prisma };
  }

  it('explore only asks for verified, published vehicles with no approved driver', async () => {
    const { svc, prisma } = makeSvc();
    const res: any[] = await svc.explore('driver-user');
    expect(prisma.vehicle.findMany.mock.calls[0][0].where.status).toBe('AVAILABLE');
    expect(prisma.vehicle.findMany.mock.calls[0][0].where.verificationStatus).toBe('APPROVED');
    expect(res[0].interestCount).toBe(2);
  });

  it('expressing interest creates the interest, a chat thread, and notifies the owner', async () => {
    const { svc, prisma } = makeSvc();
    const res: any = await svc.expressInterest('driver-user', 'veh-1', 'I am available full time');
    expect(res.interest.status).toBe('PENDING');
    expect(res.thread.id).toBe('thread-1');
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.chatMessage.create).toHaveBeenCalled();
  });

  it('interest is refused once the owner has chosen a driver', async () => {
    const { svc, prisma } = makeSvc();
    prisma.vehicleInterest.findFirst.mockResolvedValue({ id: 'int-x', status: 'APPROVED' });
    await expect(svc.expressInterest('driver-user', 'veh-1')).rejects.toThrow(/already chosen a driver/);
  });

  it('non-drivers cannot show interest', async () => {
    const { svc, prisma } = makeSvc();
    prisma.driver.findUnique.mockResolvedValue(null);
    await expect(svc.expressInterest('owner-user', 'veh-1')).rejects.toThrow(/Only drivers/);
  });

  it('approving a second driver conflicts until the first is released', async () => {
    const { svc, prisma } = makeSvc();
    prisma.vehicleInterest.findUnique.mockResolvedValue({ id: 'int-1', vehicleId: 'veh-1', driverUserId: 'driver-user', status: 'PENDING' });
    prisma.vehicleInterest.findFirst.mockResolvedValue({ id: 'int-other', status: 'APPROVED' });
    // loadInterestForOwner uses findUnique by id
    await expect(svc.approveInterest('owner-user', 'OWNER', 'int-1')).rejects.toThrow(/already been approved/);
  });

  it('only conversation participants can read or send messages', async () => {
    const { svc } = makeSvc();
    await expect(svc.listMessages('stranger', 'thread-1')).rejects.toThrow(/Access denied/);
    await expect(svc.sendMessage('stranger', 'thread-1', { body: 'hi' })).rejects.toThrow(/Access denied/);
    const msg: any = await svc.sendMessage('driver-user', 'thread-1', { body: 'Hello owner' });
    expect(msg.body).toBe('Hello owner');
  });

  it('access code needs an approved interest and is only returned hashed in storage', async () => {
    const contract: any = {
      id: 'c-1', vehicleId: 'veh-1', createdBy: 'owner-user',
      parties: [{ userId: 'owner-user', role: 'OWNER' }, { userId: 'driver-user', role: 'DRIVER', driverId: 'driver-1' }],
    };
    const { svc, prisma } = makeSvc();
    prisma.contract.findUnique.mockResolvedValue(contract);
    await expect(svc.generateAccessCode('owner-user', 'c-1')).rejects.toThrow(/approved on Explore/);
    prisma.vehicleInterest.findFirst.mockResolvedValue({ id: 'int-1', status: 'APPROVED' });
    const res: any = await svc.generateAccessCode('owner-user', 'c-1');
    expect(res.code).toMatch(/^\d{6}$/);
    const stored = prisma.contractAccessCode.create.mock.calls[0][0].data;
    expect(stored.codeHash).not.toBe(res.code);
    expect(stored.codeHash).toBe(MarketplaceService.hashCode(res.code));
  });

  it('access code also works for a directly shared contract — no Explore approval needed', async () => {
    const contract: any = {
      id: 'c-2', vehicleId: 'veh-1', createdBy: 'owner-user',
      parties: [{ userId: 'owner-user', role: 'OWNER' }, { userId: 'driver-user', role: 'DRIVER', driverId: 'driver-1' }],
    };
    const { svc, prisma } = makeSvc();
    prisma.contract.findUnique.mockResolvedValue(contract);
    prisma.chatThread.findFirst = jest.fn().mockResolvedValue({ id: 'thread-direct', contractId: 'c-2', driverUserId: 'driver-user', interestId: null });
    const res: any = await svc.generateAccessCode('owner-user', 'c-2');
    expect(res.code).toMatch(/^\d{6}$/);
    expect(res.threadId).toBe('thread-direct');
    const stored = prisma.contractAccessCode.create.mock.calls[0][0].data;
    expect(stored.codeHash).toBe(MarketplaceService.hashCode(res.code));
  });
});

describe('MarketplaceService chat usernames and direct threads', () => {
  function makeChatSvc() {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
          where.chatUsername === 'kwame.drives'
            ? { id: 'driver-user', firstName: 'Kwame', lastName: 'Mensah', chatUsername: 'kwame.drives', primaryRole: 'DRIVER' }
            : { id: 'owner-user', firstName: 'Lartey', lastName: 'Owner', chatUsername: null, primaryRole: 'OWNER' },
        )),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'driver-user', firstName: 'Kwame', lastName: 'Mensah', chatUsername: 'kwame.drives', primaryRole: 'DRIVER', profilePhotoUrl: '/uploads/profiles/kwame.jpg',
            driver: { id: 'driver-1', status: 'VERIFIED', nationalIdVerifiedAt: new Date(), licenceVerifiedAt: new Date() },
            owner: { id: 'owner-9', status: 'VERIFIED', nationalIdVerifiedAt: new Date() },
            serviceProvider: { id: 'sp-1', businessName: 'Kwame Auto Works', serviceType: 'MECHANIC', status: 'ACTIVE' },
            companyMembers: [{ id: 'cm-1', role: 'FLEET_MANAGER', title: null, isActive: true, company: { id: 'co-1', name: 'Lartey Company' } }],
          },
        ]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'owner-user', chatUsername: data.chatUsername, primaryRole: 'OWNER' })),
      },
      driver: { findUnique: jest.fn().mockResolvedValue({ id: 'driver-1' }) },
      chatThread: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'thread-direct', ...data })),
      },
    };
    return { svc: new MarketplaceService(prisma), prisma };
  }

  it('normalizes and validates usernames, and refuses a taken one', async () => {
    const { svc, prisma } = makeChatSvc();
    const res: any = await svc.setChatUsername('owner-user', '@Lartey.Owner');
    expect(res.chatUsername).toBe('lartey.owner');
    await expect(svc.setChatUsername('owner-user', 'ab')).rejects.toThrow(/3-20 characters/);
    prisma.user.findFirst.mockResolvedValue({ id: 'someone-else' });
    await expect(svc.setChatUsername('owner-user', 'kwame.drives')).rejects.toThrow(/already taken/);
  });

  it('search comes with the profile picture and every account the user holds — no phone or email', async () => {
    const { svc } = makeChatSvc();
    const res: any[] = await svc.searchChatUsers('owner-user', '@Kwa');
    expect(res[0].chatUsername).toBe('kwame.drives');
    expect(res[0].profilePhotoUrl).toContain('kwame.jpg');
    expect(res[0].isDriver).toBe(true);
    const types = res[0].accounts.map((a: any) => a.type);
    expect(types).toEqual(expect.arrayContaining(['DRIVER', 'OWNER', 'SERVICE_PROVIDER', 'COMPANY']));
    expect(res[0].accounts.find((a: any) => a.type === 'DRIVER').verified).toBe(true);
    expect(res[0].accounts.find((a: any) => a.type === 'COMPANY').label).toBe('Lartey Company');
    expect(res[0].accounts.find((a: any) => a.type === 'SERVICE_PROVIDER').label).toBe('Kwame Auto Works');
    expect(res[0]).not.toHaveProperty('phone');
    expect(res[0]).not.toHaveProperty('email');
    expect(JSON.stringify(res[0])).not.toContain('ghanaCard');
    expect(await svc.searchChatUsers('owner-user', 'k')).toEqual([]);
  });

  it('direct thread needs my username first, then opens a vehicle-free thread', async () => {
    const { svc, prisma } = makeChatSvc();
    await expect(svc.startDirectThread('owner-user', 'kwame.drives')).rejects.toThrow(/Create your chat username first/);
    prisma.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve(
      where.id
        ? { id: 'owner-user', chatUsername: 'lartey.owner', primaryRole: 'OWNER' }
        : where.chatUsername === 'kwame.drives'
          ? { id: 'driver-user', chatUsername: 'kwame.drives', primaryRole: 'DRIVER' }
          : null,
    ));
    const res: any = await svc.startDirectThread('owner-user', '@kwame.drives');
    expect(res.thread.vehicleId).toBeNull();
    expect(res.thread.driverUserId).toBe('driver-user');
    await expect(svc.startDirectThread('owner-user', 'ghost.user')).rejects.toThrow(/No user found with username/);
  });
});
