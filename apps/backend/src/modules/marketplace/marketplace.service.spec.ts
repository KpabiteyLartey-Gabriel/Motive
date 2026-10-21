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
});
