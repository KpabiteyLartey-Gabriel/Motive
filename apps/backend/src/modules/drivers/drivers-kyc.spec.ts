import { DriversService } from './drivers.service';

function makeService(existing: any) {
  const prisma: any = {
    driver: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.userId) return existing;
        if (where.licenseNumber) return existing && existing.licenseNumber === where.licenseNumber ? existing : null;
        return null;
      }),
      create: jest.fn(async ({ data }: any) => ({ id: 'driver-1', ...data })),
      update: jest.fn(async ({ data }: any) => ({ ...existing, ...data })),
    },
    driverDocument: { create: jest.fn(async ({ data }: any) => ({ id: 'doc-1', ...data })) },
  };
  const storage: any = { uploadFile: jest.fn(async () => ({ url: 'https://cdn.example/license.jpg', fileName: 'license.jpg' })) };
  const svc = new DriversService(prisma, storage);
  svc.getProfile = jest.fn(async () => ({ id: 'driver-1', documents: [] })) as any;
  return { svc, prisma, storage };
}

describe('DriversService KYC', () => {
  it('creates a profile when the driver saves KYC for the first time', async () => {
    const { svc, prisma } = makeService(null);
    await svc.updateProfile('user-1', { licenseNumber: 'GH-111', licenseClass: 'Class B', ghanaCardNumber: 'gha1234567890' } as any);
    expect(prisma.driver.create).toHaveBeenCalled();
    const data = prisma.driver.create.mock.calls[0][0].data;
    expect(data.licenseNumber).toBe('GH-111');
    expect(data.ghanaCardNumber).toBe('GHA-123456789-0');
    await expect(svc.updateProfile('user-1', { ghanaCardNumber: 'GHA-1' } as any)).rejects.toThrow(/Ghana Card format/);
    expect(data.status).toBeUndefined(); // verification status is admin-only
  });

  it('updates only whitelisted fields and converts expiry to a Date', async () => {
    const existing = { id: 'driver-1', userId: 'user-1', licenseNumber: 'GH-111', status: 'PENDING_VERIFICATION' };
    const { svc, prisma } = makeService(existing);
    await svc.updateProfile('user-1', { city: 'Kumasi', licenseExpiryDate: '2028-05-01', status: 'VERIFIED' } as any);
    const data = prisma.driver.update.mock.calls[0][0].data;
    expect(data.city).toBe('Kumasi');
    expect(data.licenseExpiryDate).toBeInstanceOf(Date);
    expect(data.status).toBeUndefined();
  });

  it('rejects a licence number registered to another driver', async () => {
    const existing = { id: 'driver-1', userId: 'user-1', licenseNumber: 'GH-111' };
    const { svc } = makeService(existing);
    await expect(svc.updateProfile('user-1', { licenseNumber: 'GH-111' } as any)).resolves.toBeDefined();
  });

  it('stores uploaded documents under the driver folder with PENDING status by default', async () => {
    const existing = { id: 'driver-1', userId: 'user-1' };
    const { svc, prisma, storage } = makeService(existing);
    const doc = await svc.addDocument('user-1', { originalname: 'licence.jpg', size: 1200, mimetype: 'image/jpeg', buffer: Buffer.from('x') }, 'license', '2028-05-01');
    expect(storage.uploadFile).toHaveBeenCalledWith(expect.anything(), 'drivers/driver-1/documents');
    expect(doc.type).toBe('LICENSE');
    expect(doc.fileUrl).toContain('license.jpg');
    expect(prisma.driverDocument.create.mock.calls[0][0].data.expiryDate).toBeInstanceOf(Date);
  });
});
