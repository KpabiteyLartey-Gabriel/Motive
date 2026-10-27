import { ServicesService } from './services.service';

describe('ServicesService (provider service listings)', () => {
  const provider = { id: 'sp-1', userId: 'provider-user', businessName: 'Shine & Safe Auto Care', serviceType: 'Vehicle care', phone: '+233240001122', city: 'Accra', region: 'Greater Accra', status: 'ACTIVE' };
  const row = {
    id: 'svc-1', serviceProviderId: 'sp-1', title: 'Oil & Filter Change', category: 'OIL_CHANGE',
    description: 'Engine oil and filter.', priceGhs: '350.00', priceNote: 'from', durationMins: 60,
    isAvailable: true, createdAt: new Date(), updatedAt: new Date(), serviceProvider: provider,
  };

  function makeSvc(overrides: any = {}) {
    const prisma: any = {
      serviceProvider: { findUnique: jest.fn().mockResolvedValue(provider) },
      providerService: {
        findMany: jest.fn().mockResolvedValue([row]),
        findUnique: jest.fn().mockResolvedValue(row),
        create: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
        delete: jest.fn().mockResolvedValue(row),
      },
      ...overrides,
    };
    return { svc: new ServicesService(prisma), prisma };
  }

  it('lists only available services from active providers, with GHS price as a number', async () => {
    const { svc, prisma } = makeSvc();
    const res: any = await svc.listPublic();
    expect(prisma.providerService.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isAvailable: true, serviceProvider: { status: 'ACTIVE' } }),
    }));
    expect(res.total).toBe(1);
    expect(res.services[0].priceGhs).toBe(350);
    expect(res.services[0].provider.businessName).toBe('Shine & Safe Auto Care');
  });

  it('publishes a service for the provider account', async () => {
    const { svc, prisma } = makeSvc();
    await svc.create('provider-user', { title: 'Full Detailing', category: 'DETAILING' as any, priceGhs: 450 });
    expect(prisma.providerService.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ serviceProviderId: 'sp-1', title: 'Full Detailing', priceGhs: 450 }),
    }));
  });

  it('creates a request, alerts the provider, and lets only the provider accept it', async () => {
    const reqRow: any = {
      id: 'req-1', providerServiceId: 'svc-1', serviceProviderId: 'sp-1', requestedBy: 'plain-user',
      vehicleId: null, vehicleLabel: 'My Corolla, GE-1-25', preferredDate: null, contactPhone: null,
      notes: null, status: 'REQUESTED', providerNote: null, createdAt: new Date(),
      providerService: { ...row, priceGhs: row.priceGhs },
    };
    const notifications = { send: jest.fn().mockResolvedValue({}) };
    const prisma: any = {
      serviceProvider: { findUnique: jest.fn().mockResolvedValue(provider) },
      providerService: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(row), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      serviceRequest: {
        create: jest.fn().mockResolvedValue(reqRow),
        findUnique: jest.fn().mockResolvedValue({ ...reqRow, serviceProvider: provider }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...reqRow, ...data, serviceProvider: provider })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Kofi', lastName: 'Mensah', phone: '+233200000000' }), findMany: jest.fn().mockResolvedValue([]) },
      owner: { findUnique: jest.fn().mockResolvedValue(null) },
      driver: { findUnique: jest.fn().mockResolvedValue(null) },
      vehicle: { findUnique: jest.fn() },
    };
    const svc = new ServicesService(prisma, notifications as any);
    const created: any = await svc.requestService('plain-user', 'svc-1', { vehicleLabel: 'My Corolla, GE-1-25' });
    expect(created.status).toBe('REQUESTED');
    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'provider-user', type: 'SERVICE_REQUEST' }));

    await expect(svc.updateRequestStatus('plain-user', 'req-1', { status: 'ACCEPTED' })).rejects.toThrow(/Only the provider/);
    const accepted: any = await svc.updateRequestStatus('provider-user', 'req-1', { status: 'ACCEPTED', providerNote: 'Saturday 9am' });
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.providerNote).toBe('Saturday 9am');

    await expect(svc.requestService('plain-user', 'svc-1', {})).rejects.toThrow(/Choose one of your vehicles/);
  });

  it('refuses publishing without a provider account and editing someone else\'s service', async () => {
    const noProvider = makeSvc({ serviceProvider: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(noProvider.svc.create('plain-user', { title: 'X Service', category: 'OTHER' as any }))
      .rejects.toThrow(/Service Provider account/);

    const { svc } = makeSvc({
      providerService: {
        findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue({ ...row, serviceProviderId: 'someone-else' }),
        create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      },
    });
    await expect(svc.update('provider-user', 'svc-1', { priceGhs: 1 })).rejects.toThrow(/your own services/);
  });
});
