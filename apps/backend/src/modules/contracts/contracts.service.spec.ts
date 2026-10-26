import { ContractsService } from './contracts.service';

describe('ContractsService platform admin oversight', () => {
  const contract: any = { id: 'c-1', status: 'DRAFT', vehicleId: 'v-1', parties: [{ userId: 'someone-else' }] };
  const findMany = jest.fn().mockResolvedValue([]);
  const update = jest.fn().mockImplementation(({ data }: any) => { Object.assign(contract, data); return Promise.resolve(contract); });
  const prisma: any = {
    contract: { findMany, count: jest.fn().mockResolvedValue(0), findUnique: jest.fn().mockImplementation(() => Promise.resolve(contract)), update },
    user: { findUnique: jest.fn().mockResolvedValue({ primaryRole: 'SUPER_ADMIN' }) },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
  const audit: any = { log: jest.fn().mockResolvedValue({}) };
  const svc = new ContractsService(prisma, audit);
  beforeEach(() => jest.clearAllMocks());

  it('platform admin sees all contracts (no party filter)', async () => {
    await svc.findAll({ userId: 'admin-1', userRole: 'SUPER_ADMIN' } as any);
    expect(findMany.mock.calls[0][0].where.parties).toBeUndefined();
  });

  it('platform admin can open a contract they are not party to', async () => {
    const res: any = await svc.findById('c-1', 'admin-1', 'SUPER_ADMIN');
    expect(res.id).toBe('c-1');
  });

  it('platform admin can move a contract status (review/suspend/activate)', async () => {
    const res: any = await svc.updateStatus('c-1', 'admin-1', 'SUPER_ADMIN', 'SUSPENDED');
    expect(res.status).toBe('SUSPENDED');
    expect(audit.log).toHaveBeenCalled();
  });

  it('non-oversight users cannot change contract status', async () => {
    await expect(svc.updateStatus('c-1', 'user-2', 'OWNER', 'ACTIVE')).rejects.toThrow();
  });

  it('findAll can filter by vehicleId (contracts per vehicle)', async () => {
    await svc.findAll({ userId: 'admin-1', userRole: 'SUPER_ADMIN', vehicleId: 'v-1' } as any);
    expect(findMany.mock.calls[0][0].where.vehicleId).toBe('v-1');
  });
});

describe('ContractsService Explore access-code confirmation', () => {
  const { createHash } = require('crypto');
  const contract: any = {
    id: 'c-1', status: 'DRAFT', vehicleId: 'veh-1', createdBy: 'owner-user',
    parties: [
      { id: 'p-1', userId: 'owner-user', role: 'OWNER', signedAt: null },
      { id: 'p-2', userId: 'driver-user', role: 'DRIVER', signedAt: null },
    ],
  };
  const tx: any = {
    contractParty: { update: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue(contract.parties) },
    contract: { update: jest.fn().mockResolvedValue({}) },
    vehicle: { update: jest.fn().mockResolvedValue({}) },
  };
  const codeRecord: any = {
    id: 'code-1', contractId: 'c-1', driverUserId: 'driver-user', status: 'ACTIVE',
    codeHash: createHash('sha256').update('123456').digest('hex'),
  };
  const prisma: any = {
    contract: {
      findUnique: jest.fn().mockResolvedValue(contract),
      findMany: jest.fn().mockResolvedValue([contract]),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue(contract),
    },
    contractAccessCode: {
      findFirst: jest.fn().mockResolvedValue(codeRecord),
      findMany: jest.fn().mockResolvedValue([codeRecord]),
      update: jest.fn().mockImplementation(({ data }: any) => { Object.assign(codeRecord, data); return Promise.resolve(codeRecord); }),
    },
    vehicleInterest: { findFirst: jest.fn().mockResolvedValue({ id: 'int-1', status: 'APPROVED' }) },
    chatThread: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue({ primaryRole: 'OWNER' }) },
    $transaction: jest.fn(async (cb: any) => (typeof cb === 'function' ? cb(tx) : Promise.all(cb))),
  };
  const audit: any = { log: jest.fn().mockResolvedValue({}) };
  const svc = new ContractsService(prisma, audit);
  beforeEach(() => { jest.clearAllMocks(); contract.parties[1].signedAt = null; codeRecord.status = 'ACTIVE'; prisma.contractAccessCode.findFirst.mockResolvedValue(codeRecord); prisma.vehicleInterest.findFirst.mockResolvedValue({ id: 'int-1', status: 'APPROVED' }); prisma.chatThread.findFirst.mockResolvedValue(null); prisma.contract.findUnique.mockResolvedValue(contract); });

  it('plain accept is blocked while an access code is active', async () => {
    await expect(svc.acceptContract('c-1', 'driver-user')).rejects.toThrow(/access code/);
  });

  it('wrong code is rejected and the contract stays unsigned', async () => {
    await expect(svc.confirmWithCode('c-1', 'driver-user', '999999')).rejects.toThrow(/not correct/);
    expect(contract.parties[1].signedAt).toBeNull();
  });

  it('a driver whose interest was not approved cannot confirm', async () => {
    prisma.vehicleInterest.findFirst.mockResolvedValue(null);
    await expect(svc.confirmWithCode('c-1', 'driver-user', '123456')).rejects.toThrow(/has not been approved/);
  });

  it('a direct (physically agreed) contract confirms with its code and no Explore interest', async () => {
    prisma.vehicleInterest.findFirst.mockResolvedValue(null);
    prisma.chatThread.findFirst.mockResolvedValue({ id: 'thread-direct', contractId: 'c-1', driverUserId: 'driver-user', interestId: null });
    tx.contractParty.update.mockImplementation(({ where, data }: any) => {
      const party = contract.parties.find((p: any) => p.id === where.id);
      if (party && data.signedAt) party.signedAt = data.signedAt;
      return Promise.resolve(party);
    });
    const res: any = await svc.confirmWithCode('c-1', 'driver-user', '123456');
    expect(codeRecord.status).toBe('USED');
    expect(contract.parties[1].signedAt).toBeTruthy();
    expect(res.id).toBe('c-1');
  });

  it('a failed signing does not burn the code — the driver can retry with it', async () => {
    tx.contractParty.update.mockRejectedValueOnce(new Error('Transaction already closed'));
    await expect(svc.confirmWithCode('c-1', 'driver-user', '123456')).rejects.toThrow(/Transaction already closed/);
    expect(codeRecord.status).toBe('ACTIVE');
    expect(prisma.contractAccessCode.update).not.toHaveBeenCalled();
  });

  it('correct code marks the code used and signs the driver in', async () => {
    tx.contractParty.update.mockImplementation(({ where, data }: any) => {
      const party = contract.parties.find((p: any) => p.id === where.id);
      if (party && data.signedAt) party.signedAt = data.signedAt;
      return Promise.resolve(party);
    });
    const res: any = await svc.confirmWithCode('c-1', 'driver-user', '123456');
    expect(codeRecord.status).toBe('USED');
    expect(contract.parties[1].signedAt).toBeTruthy();
    expect(res.id).toBe('c-1');
  });
});

describe('ContractsService schedule starts on the signing day, not the creation day', () => {
  it('anchors start date, end date and due dates at activation', async () => {
    const createdLongAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const contract: any = {
      id: 'c-sign', status: 'DRAFT', vehicleId: 'v-1', type: 'WORK_AND_PAY',
      startDate: null, endDate: null, createdAt: createdLongAgo,
      parties: [
        { id: 'p-1', userId: 'owner-user', role: 'OWNER', signedAt: new Date() },
        { id: 'p-2', userId: 'driver-user', role: 'DRIVER', signedAt: null },
      ],
    };
    const contractUpdates: any[] = [];
    const scheduleUpdates: any[] = [];
    const tx: any = {
      contractParty: {
        update: jest.fn(({ where, data }: any) => {
          const party = contract.parties.find((p: any) => p.id === where.id);
          if (party && data.signedAt) party.signedAt = data.signedAt;
          return Promise.resolve(party);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(contract.parties)),
      },
      contract: { update: jest.fn(({ data }: any) => { contractUpdates.push(data); return Promise.resolve(contract); }) },
      vehicle: { update: jest.fn().mockResolvedValue({}) },
      workAndPayTerms: { findUnique: jest.fn().mockResolvedValue({ installmentFrequency: 'WEEKLY', totalInstallments: 2, gracePeriodDays: 2 }) },
      paymentSchedule: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's-1', installmentNumber: 1 }, { id: 's-2', installmentNumber: 2 },
        ]),
        update: jest.fn(({ where, data }: any) => { scheduleUpdates.push({ id: where.id, dueDate: data.dueDate }); return Promise.resolve({}); }),
      },
    };
    const prisma: any = {
      contract: {
        findUnique: jest.fn().mockResolvedValue(contract),
        findMany: jest.fn().mockResolvedValue([contract]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(contract),
      },
      contractAccessCode: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      driver: { findUnique: jest.fn().mockResolvedValue({ id: 'd-1', status: 'VERIFIED' }), update: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue({ primaryRole: 'OWNER' }) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    const svc = new ContractsService(prisma, { log: jest.fn().mockResolvedValue({}) } as any);
    const before = Date.now();
    await svc.acceptContract('c-sign', 'driver-user', true);
    const active = contractUpdates.find((d) => d.status === 'ACTIVE');
    expect(active).toBeTruthy();
    expect(active.startDate).toBeInstanceOf(Date);
    // Counting starts after the 2-day grace period, i.e. on day 3.
    expect(active.startDate.getTime()).toBeGreaterThanOrEqual(before + 2 * 24 * 60 * 60 * 1000);
    expect(active.startDate.getTime()).toBeLessThan(before + 2 * 24 * 60 * 60 * 1000 + 60 * 1000);
    expect(active.endDate.getTime() - active.startDate.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
    expect(scheduleUpdates).toHaveLength(2);
    expect(scheduleUpdates[0].dueDate.getTime() - active.startDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(scheduleUpdates[1].dueDate.getTime() - active.startDate.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
  });
});

describe('ContractsService vehicle value is owner-only', () => {
  function makeSvc() {
    const contract: any = {
      id: 'c-val', status: 'DRAFT', vehicleId: 'v-1', type: 'WORK_AND_PAY',
      parties: [
        { userId: 'owner-user', role: 'OWNER', signedAt: new Date() },
        { userId: 'driver-user', role: 'DRIVER', signedAt: null },
      ],
      workAndPayTerms: { vehicleValue: 120000, totalPayable: 240000, depositAmount: 5000, installmentAmount: 1400, totalInstallments: 172 },
    };
    const prisma: any = {
      contract: { findUnique: jest.fn().mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(contract, (k, v) => v instanceof Date ? v.toISOString() : v)))) },
      contractAccessCode: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return new ContractsService(prisma, { log: jest.fn().mockResolvedValue({}) } as any);
  }

  it('drivers never receive the vehicle value in a contract', async () => {
    const res: any = await makeSvc().findById('c-val', 'driver-user', 'DRIVER');
    expect(res.workAndPayTerms.totalPayable).toBe(240000);
    expect(res.workAndPayTerms.vehicleValue).toBeUndefined();
  });

  it('owners still receive the vehicle value for their profit records', async () => {
    const res: any = await makeSvc().findById('c-val', 'owner-user', 'OWNER');
    expect(res.workAndPayTerms.vehicleValue).toBe(120000);
  });
});

describe('ContractsService creator signs by creating', () => {
  it('records the creator party as signed at creation, so the driver confirmation can activate the contract', async () => {
    let createdParties: any[] = [];
    const tx: any = {
      contract: {
        create: jest.fn(({ data }: any) => { createdParties = data.parties.create; return Promise.resolve({ id: 'c-new' }); }),
      },
      workAndPayTerms: { create: jest.fn().mockResolvedValue({}) },
      paymentObligation: { create: jest.fn().mockResolvedValue({ id: 'ob-1' }) },
      paymentSchedule: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-user', primaryRole: 'OWNER' }) },
      vehicle: { findUnique: jest.fn().mockResolvedValue({ id: 'v-1' }) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    const svc = new ContractsService(prisma, { log: jest.fn().mockResolvedValue({}) } as any);
    jest.spyOn(svc, 'findById').mockResolvedValue({ id: 'c-new' } as any);
    await svc.create('owner-user', {
      type: 'WORK_AND_PAY', vehicleId: 'v-1',
      parties: [{ userId: 'driver-user', role: 'DRIVER' }],
      workAndPayTerms: { vehicleValue: 10000, depositAmount: 500, totalPayable: 3000, installmentAmount: 1000, installmentFrequency: 'WEEKLY', totalInstallments: 3 },
    } as any);
    const creator = createdParties.find((p) => p.userId === 'owner-user');
    const driver = createdParties.find((p) => p.userId === 'driver-user');
    expect(creator.signedAt).toBeInstanceOf(Date);
    expect(driver.signedAt).toBeUndefined();
  });
});

describe('ContractsService driver activity (ACTIVE = currently on a contract)', () => {
  function makeSvc(driverStatus: string, activeCount: number) {
    const contract: any = {
      id: 'c-9', status: 'ACTIVE', vehicleId: null,
      parties: [
        { id: 'p-1', userId: 'owner-user', role: 'OWNER', signedAt: new Date() },
        { id: 'p-2', userId: 'driver-user', role: 'DRIVER', signedAt: new Date() },
      ],
    };
    const driverUpdate = jest.fn().mockResolvedValue({});
    const prisma: any = {
      contract: {
        findUnique: jest.fn().mockResolvedValue(contract),
        update: jest.fn().mockResolvedValue(contract),
        count: jest.fn().mockResolvedValue(activeCount),
      },
      contractParty: { findMany: jest.fn().mockResolvedValue([{ userId: 'driver-user' }]) },
      driver: {
        findUnique: jest.fn().mockResolvedValue({ id: 'd-1', status: driverStatus }),
        update: driverUpdate,
      },
      user: { findUnique: jest.fn().mockResolvedValue({ primaryRole: 'OWNER' }) },
      $transaction: jest.fn(async (cb: any) => cb({})),
    };
    const audit: any = { log: jest.fn().mockResolvedValue({}) };
    return { svc: new ContractsService(prisma, audit), driverUpdate, contract };
  }

  it('flips a VERIFIED driver to ACTIVE when their contract is live', async () => {
    const { svc, driverUpdate } = makeSvc('VERIFIED', 1);
    await (svc as any).refreshContractDrivers('c-9');
    expect(driverUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ACTIVE' } }));
  });

  it('returns an ACTIVE driver to VERIFIED when no live contract remains', async () => {
    const { svc, driverUpdate } = makeSvc('ACTIVE', 0);
    await (svc as any).refreshContractDrivers('c-9');
    expect(driverUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'VERIFIED' } }));
  });

  it('never overrides a SUSPENDED driver', async () => {
    const { svc, driverUpdate } = makeSvc('SUSPENDED', 1);
    await (svc as any).refreshContractDrivers('c-9');
    expect(driverUpdate).not.toHaveBeenCalled();
  });

  it('terminating the last active contract returns the driver to VERIFIED end-to-end', async () => {
    const { svc, driverUpdate } = makeSvc('ACTIVE', 0);
    await svc.terminateContract('c-9', 'owner-user', 'done');
    expect(driverUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'VERIFIED' } }));
  });
});

describe('ContractsService share a direct contract by chat username', () => {
  function makeShareSvc(messaging: any = undefined) {
    const contract: any = {
      id: 'c-direct', status: 'DRAFT', vehicleId: 'veh-1', createdBy: 'owner-user', type: 'WORK_AND_PAY',
      parties: [{ id: 'p-1', userId: 'owner-user', role: 'OWNER', signedAt: new Date() }],
      vehicle: { id: 'veh-1', make: 'Toyota', model: 'Corolla', registrationNumber: 'GR-9-26' },
      workAndPayTerms: { depositAmount: 1000, installmentAmount: 500, installmentFrequency: 'WEEKLY', totalInstallments: 10, totalPayable: 5000, gracePeriodDays: 3 },
    };
    const prisma: any = {
      contract: { findUnique: jest.fn().mockResolvedValue(contract) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'driver-user', firstName: 'Kwame', lastName: 'Mensah', chatUsername: 'kwame.drives', email: 'kwame@test.com' }) },
      driver: { findUnique: jest.fn().mockResolvedValue({ id: 'driver-1', userId: 'driver-user' }) },
      contractParty: { create: jest.fn().mockResolvedValue({ id: 'p-2' }) },
      chatThread: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'thread-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
      },
      contractAccessCode: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'code-1' }),
      },
      chatMessage: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    return { svc: new ContractsService(prisma, { log: jest.fn().mockResolvedValue({}) } as any, messaging), prisma, contract };
  }

  it('adds the driver as party, posts a contract card, and returns a hashed-code share', async () => {
    const { svc, prisma } = makeShareSvc();
    const res: any = await svc.shareContract('c-direct', 'owner-user', '@Kwame.Drives');
    expect(res.code).toMatch(/^\d{6}$/);
    expect(res.shareLink).toBe('/driver/contracts?contract=c-direct');
    expect(res.driver.chatUsername).toBe('kwame.drives');
    expect(prisma.contractParty.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'driver-user', role: 'DRIVER' }),
    }));
    const card = prisma.chatMessage.create.mock.calls[0][0].data;
    expect(card.kind).toBe('CONTRACT');
    expect(card.contractId).toBe('c-direct');
    expect(card.body).toContain('/driver/contracts?contract=c-direct');
    expect(card.body).not.toContain(res.code);
    const stored = prisma.contractAccessCode.create.mock.calls[0][0].data;
    expect(stored.codeHash).not.toBe(res.code);
  });

  it('a DriveOn contract shares with the owner-set sales terms in the card', async () => {
    const { svc, prisma, contract } = makeShareSvc();
    contract.type = 'DRIVING_ON';
    contract.workAndPayTerms = undefined;
    contract.drivingOnTerms = { dailySalesAmount: 250, paymentFrequency: 'WEEKLY' };
    contract.terms = { source: 'DIRECT', gracePeriodDays: 2, duration: { value: 3, unit: 'MONTHS' } };
    const res: any = await svc.shareContract('c-direct', 'owner-user', 'kwame.drives');
    expect(res.code).toMatch(/^\d{6}$/);
    const card = prisma.chatMessage.create.mock.calls[0][0].data;
    expect(card.body).toContain('DriveOn');
    expect(card.body).toContain('250');
    expect(card.body).toContain('3 months');
    expect(card.body).not.toContain(res.code);
  });

  it('posts the contract into the chat the pair already has — never a second conversation', async () => {
    const { svc, prisma } = makeShareSvc();
    const existing = { id: 'thread-direct', interestId: null, contractId: null, ownerUserId: 'owner-user', driverUserId: 'driver-user', vehicleId: null };
    prisma.chatThread.findFirst.mockImplementation(({ where }: any) => Promise.resolve(
      where.contractId ? null : existing,
    ));
    const res: any = await svc.shareContract('c-direct', 'owner-user', 'kwame.drives');
    expect(res.threadId).toBe('thread-direct');
    expect(prisma.chatThread.create).not.toHaveBeenCalled();
    const card = prisma.chatMessage.create.mock.calls[0][0].data;
    expect(card.threadId).toBe('thread-direct');
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'driver-user', type: 'CONTRACT_SHARED' }),
    }));
  });

  it('also emails the driver about the shared contract', async () => {
    const messaging = { sendEmail: jest.fn().mockResolvedValue({ delivered: true, provider: 'smtp' }) };
    const { svc } = makeShareSvc(messaging);
    const res: any = await svc.shareContract('c-direct', 'owner-user', 'kwame.drives');
    expect(res.emailSent).toBe(true);
    expect(messaging.sendEmail).toHaveBeenCalledWith(
      'kwame@test.com',
      expect.stringContaining('contract was shared'),
      expect.stringContaining('/driver/contracts?contract=c-direct'),
    );
    expect(messaging.sendEmail.mock.calls[0][2]).not.toContain(res.code);
  });

  it('refuses an unknown username and a user with no Driver account', async () => {
    const { svc, prisma } = makeShareSvc();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.shareContract('c-direct', 'owner-user', 'nobody')).rejects.toThrow(/No user found with username/);
    prisma.user.findUnique.mockResolvedValue({ id: 'plain-user', firstName: 'Ama', lastName: 'Serwaa', chatUsername: 'ama' });
    prisma.driver.findUnique.mockResolvedValue(null);
    await expect(svc.shareContract('c-direct', 'owner-user', 'ama')).rejects.toThrow(/does not have a Driver account/);
  });

  it('only the owner side can share, and only while the contract is a draft', async () => {
    const { svc, contract } = makeShareSvc();
    await expect(svc.shareContract('c-direct', 'stranger', 'kwame.drives')).rejects.toThrow(/Only the owner side/);
    contract.status = 'ACTIVE';
    await expect(svc.shareContract('c-direct', 'owner-user', 'kwame.drives')).rejects.toThrow(/Only a draft contract/);
  });
});
