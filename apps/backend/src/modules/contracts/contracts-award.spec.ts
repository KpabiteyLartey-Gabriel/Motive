import { ContractsService } from './contracts.service';

describe('ContractsService template attach + award', () => {
  const vehicle: any = { id: 'veh-1', ownerId: 'owner-1', make: 'Toyota', model: 'Hiace', registrationNumber: 'GR-9-26' };
  const contract: any = {
    id: 'c-1', type: 'WORK_AND_PAY', status: 'DRAFT', vehicleId: null, createdBy: 'owner-user',
    terms: { offDays: 'Sundays' },
    parties: [{ id: 'p-1', userId: 'owner-user', role: 'OWNER', signedAt: new Date() }],
    vehicle: null,
    workAndPayTerms: { depositAmount: 1000, installmentAmount: 500, installmentFrequency: 'WEEKLY', totalInstallments: 10, totalPayable: 6000, gracePeriodDays: 3 },
    drivingOnTerms: null, rentalTerms: null,
  };

  function makeSvc(overrides: any = {}) {
    const prisma: any = {
      contract: {
        findUnique: jest.fn().mockResolvedValue({ ...contract, parties: [...contract.parties], vehicle: contract.vehicleId ? vehicle : null }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      vehicle: { findUnique: jest.fn().mockResolvedValue(vehicle), update: jest.fn().mockResolvedValue({}) },
      owner: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-1', userId: 'owner-user' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'target-1', firstName: 'Kofi', lastName: 'D', chatUsername: 'kofi', email: 'k@test.com', phone: '+233200000000', profilePhotoUrl: null }) },
      driver: { findUnique: jest.fn().mockResolvedValue(null) },
      contractParty: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
      chatThread: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 't-1', contractId: 'c-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      chatMessage: { create: jest.fn().mockResolvedValue({}) },
      contractAccessCode: { updateMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
      notification: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
      ...overrides,
    };
    const notifications: any = { send: jest.fn().mockResolvedValue({}) };
    const svc = new ContractsService(prisma, { log: jest.fn() } as any, undefined, notifications);
    return { svc, prisma, notifications };
  }

  it('attaches a template only to a vehicle the owner owns', async () => {
    const { svc, prisma } = makeSvc();
    jest.spyOn(svc, 'findById').mockResolvedValue({ id: 'c-1', vehicleId: 'veh-1' } as any);
    const res: any = await svc.attachVehicle('c-1', 'owner-user', 'veh-1');
    expect(res.vehicleId).toBe('veh-1');
    expect(prisma.contract.update).toHaveBeenCalledWith(expect.objectContaining({ data: { vehicleId: 'veh-1' } }));

    const foreign = makeSvc({ vehicle: { findUnique: jest.fn().mockResolvedValue({ ...vehicle, ownerId: 'someone-else' }), update: jest.fn() } });
    await expect(foreign.svc.attachVehicle('c-1', 'owner-user', 'veh-1')).rejects.toThrow(/your own vehicles/);
  });

  it('awards to a user without a Driver account and sends the code straight to them', async () => {
    const { svc, notifications } = makeSvc();
    jest.spyOn(svc as any, 'findById').mockResolvedValue({});
    const attached = { ...contract, vehicleId: 'veh-1', vehicle, parties: [...contract.parties] };
    const { prisma } = makeSvc();
    void prisma;
    const svc2 = svc;
    (svc2 as any).prisma.contract.findUnique.mockResolvedValue(attached);

    const res: any = await svc2.awardContract('c-1', 'owner-user', '@Kofi');
    expect(res.requiresDriverAccount).toBe(true);
    expect(res.driver).toMatchObject({ chatUsername: 'kofi', hasDriverAccount: false });
    expect(res.codeSentTo).toEqual(expect.arrayContaining(['sms', 'email', 'in-app']));
    const codeCall = notifications.send.mock.calls.find((c: any[]) => c[0].type === 'CONTRACT_AWARDED');
    expect(codeCall[0].body).toMatch(/\b\d{6}\b/);
    expect(codeCall[0].body).toMatch(/create one in My Account first/);
  });

  it('refuses to award before a vehicle is attached', async () => {
    const { svc } = makeSvc();
    await expect(svc.awardContract('c-1', 'owner-user', 'kofi')).rejects.toThrow(/Attach this contract to a vehicle first/);
  });
});
