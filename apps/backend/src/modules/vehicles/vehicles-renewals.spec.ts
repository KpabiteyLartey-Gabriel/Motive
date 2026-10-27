import { VehiclesService } from './vehicles.service';

describe('VehiclesService renewals (Servicing tracker)', () => {
  const day = 86400000;
  const inDays = (n: number) => new Date(Date.now() + n * day);
  const vehicle: any = {
    id: 'veh-1', ownerId: 'owner-1', make: 'Toyota', model: 'Hiace', year: 2021,
    registrationNumber: 'GR-1-26', type: 'VAN', color: 'White', imageUrls: [], status: 'ACTIVE',
    insuranceExpiryDate: inDays(-5), roadWorthinessExpiryDate: inDays(10),
  };

  function makeSvc(overrides: any = {}) {
    const prisma: any = {
      owner: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-1', userId: 'owner-user' }) },
      driver: { findUnique: jest.fn().mockResolvedValue(null) },
      vehicle: {
        findMany: jest.fn().mockResolvedValue([vehicle]),
        findUnique: jest.fn().mockResolvedValue(vehicle),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...vehicle, ...data })),
      },
      notification: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
      contract: { findFirst: jest.fn().mockResolvedValue(null) },
      ...overrides,
    };
    return { svc: new VehiclesService(prisma), prisma };
  }

  it('computes EXPIRED / DUE_SOON statuses and counts, and reminds once', async () => {
    const { svc, prisma } = makeSvc();
    const res: any = await svc.getMyRenewals('owner-user');
    expect(res.counts).toEqual({ expired: 1, dueSoon: 1, notSet: 0 });
    const byKey = Object.fromEntries(res.vehicles[0].renewals.map((r: any) => [r.key, r]));
    expect(byKey.INSURANCE.status).toBe('EXPIRED');
    expect(byKey.ROADWORTHINESS.status).toBe('DUE_SOON');
    expect(res.vehicles[0].canEdit).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it('does not remind again for a stage already sent for the same expiry date', async () => {
    const { svc, prisma } = makeSvc({
      notification: {
        findMany: jest.fn().mockResolvedValue([
          { data: { vehicleId: 'veh-1', key: 'INSURANCE', stage: 'EXPIRED', expiryDate: vehicle.insuranceExpiryDate.toISOString().slice(0, 10) } },
          { data: { vehicleId: 'veh-1', key: 'ROADWORTHINESS', stage: 'D30', expiryDate: vehicle.roadWorthinessExpiryDate.toISOString().slice(0, 10) } },
        ]),
        create: jest.fn().mockResolvedValue({}),
      },
    });
    await svc.getMyRenewals('owner-user');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('only the vehicle owner can update renewal dates', async () => {
    const { svc, prisma } = makeSvc();
    const updated: any = await svc.updateRenewals('veh-1', 'owner-user', { insuranceExpiryDate: '2027-03-31' });
    expect(prisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ insuranceExpiryDate: expect.any(Date) }) }),
    );
    expect(updated.renewals.find((r: any) => r.key === 'INSURANCE').status).toBe('VALID');

    const stranger = makeSvc({ owner: { findUnique: jest.fn().mockResolvedValue({ id: 'other-owner', userId: 'x' }) } });
    await expect(stranger.svc.updateRenewals('veh-1', 'someone-else', { insuranceExpiryDate: '2027-03-31' }))
      .rejects.toThrow(/Only the vehicle owner or its Work & Pay driver/);
    await expect(svc.updateRenewals('veh-1', 'owner-user', { insuranceExpiryDate: 'not-a-date' }))
      .rejects.toThrow(/not a valid date/);
  });

  it('lets the awarded Work & Pay driver update dates, but not a Rental driver', async () => {
    const wap = makeSvc({
      owner: { findUnique: jest.fn().mockResolvedValue(null) },
      contract: { findFirst: jest.fn().mockResolvedValue({ id: 'contract-1' }) },
    });
    const updated: any = await wap.svc.updateRenewals('veh-1', 'driver-user', { roadWorthinessExpiryDate: '2027-02-28' });
    expect(updated.renewals.find((r: any) => r.key === 'ROADWORTHINESS').status).toBe('VALID');
    expect(wap.prisma.contract.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ vehicleId: 'veh-1', type: 'WORK_AND_PAY', status: 'ACTIVE' }),
    }));

    const rental = makeSvc({
      owner: { findUnique: jest.fn().mockResolvedValue(null) },
      contract: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(rental.svc.updateRenewals('veh-1', 'rental-driver', { roadWorthinessExpiryDate: '2027-02-28' }))
      .rejects.toThrow(/Work & Pay driver/);
  });

  it('reports NOT_SET when no date has been entered', async () => {
    const bare = { ...vehicle, insuranceExpiryDate: null, roadWorthinessExpiryDate: null };
    const { svc } = makeSvc({ vehicle: { findMany: jest.fn().mockResolvedValue([bare]), findUnique: jest.fn().mockResolvedValue(bare), update: jest.fn() } });
    const res: any = await svc.getMyRenewals('owner-user');
    expect(res.counts.notSet).toBe(2);
    expect(res.vehicles[0].renewals).toHaveLength(2);
    expect(res.vehicles[0].renewals.map((r: any) => r.key)).toEqual(['INSURANCE', 'ROADWORTHINESS']);
    expect(res.vehicles[0].renewals.every((r: any) => r.status === 'NOT_SET')).toBe(true);
  });

  it('proactive scan notifies the owner without anyone opening Servicing', async () => {
    const due = { ...vehicle, owner: { userId: 'owner-user' }, currentDriver: null, contracts: [] };
    const { svc, prisma } = makeSvc({
      vehicle: { findMany: jest.fn().mockResolvedValue([due]), findUnique: jest.fn().mockResolvedValue(due), update: jest.fn() },
    });
    const sent: any[] = [];
    prisma.notification.findMany = jest.fn().mockImplementation(async () => sent);
    prisma.notification.create = jest.fn().mockImplementation(async ({ data }: any) => { sent.push({ data: data.data }); return {}; });
    const res: any = await svc.scanRenewalReminders();
    expect(res).toEqual({ scanned: 1, recipients: 1 });
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    // Second scan: same stages already sent for the same expiry dates.
    await svc.scanRenewalReminders();
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });
});
