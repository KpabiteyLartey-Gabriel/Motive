import { ComplianceService } from './compliance.service';

describe('ComplianceService legal paperwork access', () => {
  const update = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rec-1', ...data }));
  const prisma: any = {
    complianceRecord: {
      findUnique: jest.fn().mockResolvedValue({ id: 'rec-1', vehicleId: 'v-1', driverId: null, status: 'VALID', expiryDate: new Date('2027-01-01') }),
      findMany: jest.fn().mockResolvedValue([]),
      update,
    },
    vehicle: { findUnique: jest.fn().mockResolvedValue({ id: 'v-1', ownerId: 'o-1', managingCompanyId: null, currentDriverId: null }) },
  };
  const audit: any = { log: jest.fn().mockResolvedValue({}) };
  const svc = new ComplianceService(prisma, audit);
  beforeEach(() => jest.clearAllMocks());

  it('legal can list paperwork for any vehicle', async () => {
    const res = await svc.listForVehicle('v-1', 'legal-1', 'LEGAL_PROFESSIONAL');
    expect(Array.isArray(res)).toBe(true);
    expect(prisma.complianceRecord.findMany).toHaveBeenCalled();
  });

  it('legal can update a document status (e.g. mark renewed)', async () => {
    const res: any = await svc.updateStatus('rec-1', 'legal-1', { expiryDate: '2028-01-01' } as any, 'LEGAL_PROFESSIONAL');
    expect(update).toHaveBeenCalled();
    expect(res.id).toBe('rec-1');
  });
});
