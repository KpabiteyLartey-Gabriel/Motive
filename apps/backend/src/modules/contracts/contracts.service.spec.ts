import { ContractsService } from './contracts.service';

describe('ContractsService legal oversight', () => {
  const contract: any = { id: 'c-1', status: 'DRAFT', vehicleId: 'v-1', parties: [{ userId: 'someone-else' }] };
  const findMany = jest.fn().mockResolvedValue([]);
  const update = jest.fn().mockImplementation(({ data }: any) => { Object.assign(contract, data); return Promise.resolve(contract); });
  const prisma: any = {
    contract: { findMany, count: jest.fn().mockResolvedValue(0), findUnique: jest.fn().mockImplementation(() => Promise.resolve(contract)), update },
    user: { findUnique: jest.fn().mockResolvedValue({ primaryRole: 'LEGAL_PROFESSIONAL' }) },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
  const audit: any = { log: jest.fn().mockResolvedValue({}) };
  const svc = new ContractsService(prisma, audit);
  beforeEach(() => jest.clearAllMocks());

  it('legal sees all contracts (no party filter)', async () => {
    await svc.findAll({ userId: 'legal-1', userRole: 'LEGAL_PROFESSIONAL' } as any);
    expect(findMany.mock.calls[0][0].where.parties).toBeUndefined();
  });

  it('legal can open a contract they are not party to', async () => {
    const res: any = await svc.findById('c-1', 'legal-1', 'LEGAL_PROFESSIONAL');
    expect(res.id).toBe('c-1');
  });

  it('legal can move a contract status (review/suspend/activate)', async () => {
    const res: any = await svc.updateStatus('c-1', 'legal-1', 'LEGAL_PROFESSIONAL', 'SUSPENDED');
    expect(res.status).toBe('SUSPENDED');
    expect(audit.log).toHaveBeenCalled();
  });

  it('non-oversight users cannot change contract status', async () => {
    await expect(svc.updateStatus('c-1', 'user-2', 'OWNER', 'ACTIVE')).rejects.toThrow();
  });

  it('findAll can filter by vehicleId (contracts per vehicle)', async () => {
    await svc.findAll({ userId: 'legal-1', userRole: 'LEGAL_PROFESSIONAL', vehicleId: 'v-1' } as any);
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
    user: { findUnique: jest.fn().mockResolvedValue({ primaryRole: 'OWNER' }) },
    $transaction: jest.fn(async (cb: any) => (typeof cb === 'function' ? cb(tx) : Promise.all(cb))),
  };
  const audit: any = { log: jest.fn().mockResolvedValue({}) };
  const svc = new ContractsService(prisma, audit);
  beforeEach(() => { jest.clearAllMocks(); contract.parties[1].signedAt = null; codeRecord.status = 'ACTIVE'; prisma.contractAccessCode.findFirst.mockResolvedValue(codeRecord); prisma.vehicleInterest.findFirst.mockResolvedValue({ id: 'int-1', status: 'APPROVED' }); prisma.contract.findUnique.mockResolvedValue(contract); });

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
