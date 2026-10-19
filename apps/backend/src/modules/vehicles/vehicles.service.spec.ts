import { VehiclesService } from './vehicles.service';

/**
 * Regression: list endpoints are called by web/mobile with only `limit`
 * (e.g. ?limit=5). Missing page must not produce NaN skip/take —
 * Prisma rejects NaN and the endpoint returned HTTP 500.
 */
describe('VehiclesService.findAll pagination', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma: any = {
    owner: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-1' }) },
    vehicle: { findMany, count },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
  const service = new VehiclesService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('defaults skip/take when page is omitted (limit only)', async () => {
    await service.findAll({ limit: 5, userId: 'user-1', userRole: 'OWNER' } as any);
    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(5);
    expect(Number.isFinite(args.skip)).toBe(true);
  });

  it('defaults skip/take when page and limit are NaN (implicit conversion)', async () => {
    await service.findAll({ page: NaN, limit: NaN, userId: 'user-1', userRole: 'OWNER' } as any);
    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });

  it('honours explicit page/limit', async () => {
    await service.findAll({ page: 3, limit: 10, userId: 'user-1', userRole: 'OWNER' } as any);
    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });
});

describe('VehiclesService publish / unpublish', () => {
  const create = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'veh-9', ...data }));
  const update = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'veh-1', ...data }));
  const prisma: any = {
    owner: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-1', userId: 'user-1' }) },
    companyMember: { findFirst: jest.fn().mockResolvedValue(null) },
    vehicle: {
      create,
      findUnique: jest.fn().mockResolvedValue({ id: 'veh-1', ownerId: 'owner-1', managingCompanyId: null, status: 'DRAFT' }),
      update,
    },
  };
  const svc = new VehiclesService(prisma);
  const dto: any = { registrationNumber: 'GR-9000-26', make: 'Toyota', model: 'Corolla', year: 2021, type: 'SEDAN', fuelType: 'PETROL', transmission: 'AUTOMATIC' };
  beforeEach(() => jest.clearAllMocks());

  it('creates a DRAFT by default and never leaks the publish flag to Prisma', async () => {
    const res: any = await svc.create('user-1', { ...dto });
    expect(res.status).toBe('DRAFT');
    expect(create.mock.calls[0][0].data.publish).toBeUndefined();
  });

  it('creates AVAILABLE when publish is true', async () => {
    const res: any = await svc.create('user-1', { ...dto, publish: true, operatingModel: 'WORK_AND_PAY' });
    expect(res.status).toBe('AVAILABLE');
    expect(res.operatingModel).toBe('WORK_AND_PAY');
  });

  it('owner can publish a draft and unpublish an available vehicle', async () => {
    const pub: any = await svc.updateStatus('veh-1', 'AVAILABLE' as any, 'user-1', 'OWNER');
    expect(pub.status).toBe('AVAILABLE');
    prisma.vehicle.findUnique.mockResolvedValueOnce({ id: 'veh-1', ownerId: 'owner-1', managingCompanyId: null, status: 'AVAILABLE' });
    const unpub: any = await svc.updateStatus('veh-1', 'DRAFT' as any, 'user-1', 'OWNER');
    expect(unpub.status).toBe('DRAFT');
  });

  it('owner cannot force lifecycle states or publish an assigned vehicle', async () => {
    await expect(svc.updateStatus('veh-1', 'ASSIGNED' as any, 'user-1', 'OWNER')).rejects.toThrow(/only publish a draft/);
    prisma.vehicle.findUnique.mockResolvedValueOnce({ id: 'veh-1', ownerId: 'owner-1', managingCompanyId: null, status: 'ASSIGNED' });
    await expect(svc.updateStatus('veh-1', 'AVAILABLE' as any, 'user-1', 'OWNER')).rejects.toThrow(/only publish a draft/);
  });

  it('another owner is denied access entirely', async () => {
    prisma.owner.findUnique.mockResolvedValueOnce({ id: 'owner-2', userId: 'user-2' });
    await expect(svc.updateStatus('veh-1', 'AVAILABLE' as any, 'user-2', 'OWNER')).rejects.toThrow(/Access denied/);
  });
});

describe('VehiclesService vehicle photos', () => {
  const vehicle: any = { id: 'veh-1', ownerId: 'owner-1', managingCompanyId: null, currentDriverId: null, imageUrls: ['https://cdn.example.com/front.jpg'] };
  const update = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...vehicle, ...data }));
  const prisma: any = {
    owner: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-1' }) },
    driver: { findUnique: jest.fn().mockResolvedValue({ id: 'driver-1' }) },
    vehicle: { findUnique: jest.fn().mockResolvedValue(vehicle), update },
  };
  const svc = new VehiclesService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('setPhotos replaces the photo list for the owner', async () => {
    const res: any = await svc.setPhotos('veh-1', ['/uploads/vehicles/a.jpg', 'https://cdn.example.com/b.jpg'], 'user-1', 'OWNER');
    expect(update).toHaveBeenCalled();
    expect(res.imageUrls).toEqual(['/uploads/vehicles/a.jpg', 'https://cdn.example.com/b.jpg']);
  });

  it('setPhotos rejects more than 10 photos and non-photo values', async () => {
    await expect(svc.setPhotos('veh-1', Array(11).fill('https://x/y.jpg'), 'user-1', 'OWNER')).rejects.toThrow();
    await expect(svc.setPhotos('veh-1', ['javascript:alert(1)'], 'user-1', 'OWNER')).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it('addPhotoUrls appends uploaded photos without dropping existing ones', async () => {
    const res: any = await svc.addPhotoUrls('veh-1', ['/uploads/vehicles/new.jpg'], 'user-1', 'OWNER');
    expect(res.imageUrls).toEqual(['https://cdn.example.com/front.jpg', '/uploads/vehicles/new.jpg']);
  });

  it('addPhotoUrls refuses drivers (read-only for photos)', async () => {
    await expect(svc.addPhotoUrls('veh-1', ['/uploads/vehicles/x.jpg'], 'user-9', 'DRIVER')).rejects.toThrow();
  });
});

describe('VehiclesService scoping for profile-less users (owner upload regression)', () => {
  // Regression: an OWNER user with no Owner profile saw ALL vehicles in the
  // list (findAll only filtered when a profile existed), then photo upload
  // correctly denied access to a vehicle owned by someone else.
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma: any = {
    owner: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'owner-new', userId: 'user-7' }),
    },
    driver: { findUnique: jest.fn().mockResolvedValue(null) },
    companyMember: { findMany: jest.fn().mockResolvedValue([]) },
    vehicle: { findMany, count, findUnique: jest.fn().mockResolvedValue({ id: 'veh-1', ownerId: 'someone-else', managingCompanyId: null, currentDriverId: null, imageUrls: [] }), update: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
  const svc = new VehiclesService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('findAll never returns unscoped vehicles for an OWNER without a profile', async () => {
    const res: any = await svc.findAll({ userId: 'user-7', userRole: 'OWNER' } as any);
    if (findMany.mock.calls.length) {
      expect(findMany.mock.calls[0][0].where.ownerId).toBeDefined();
    }
    expect(res.vehicles).toEqual([]);
  });

  it('findAll returns an empty list for a DRIVER without a driver profile', async () => {
    const res: any = await svc.findAll({ userId: 'user-8', userRole: 'DRIVER' } as any);
    expect(res.vehicles).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('photo upload still denies a vehicle owned by someone else (IDOR guard intact)', async () => {
    await expect(svc.addPhotoUrls('veh-1', ['/uploads/vehicles/x.jpg'], 'user-7', 'OWNER')).rejects.toThrow('Access denied to this vehicle');
  });
});
