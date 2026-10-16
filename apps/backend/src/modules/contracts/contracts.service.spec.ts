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
