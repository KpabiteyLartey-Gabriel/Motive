import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

function makeService(user: any, existingDriver: any = null) {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => user),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    driver: {
      findUnique: jest.fn(async () => existingDriver),
      update: jest.fn(async ({ data }: any) => ({ ...existingDriver, ...data })),
      create: jest.fn(async ({ data, include }: any) => ({
        id: 'driver-new',
        status: 'PENDING_VERIFICATION',
        ...data,
        user: { id: user.id, firstName: 'Test', lastName: 'Driver', email: user.email || null, phone: null },
      })),
    },
  };
  const audit: any = { log: jest.fn(async () => null) };
  const svc = new AdminService(prisma, audit);
  return { svc, prisma, audit };
}

describe('AdminService.provisionDriverProfile', () => {
  it('creates a PENDING_VERIFICATION profile for a DRIVER account without one', async () => {
    const { svc, prisma, audit } = makeService({ id: 'user-1', primaryRole: 'DRIVER', driver: null, email: 't@example.com' });
    const created: any = await svc.provisionDriverProfile('user-1', 'admin-1');
    expect(prisma.driver.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'user-1' } }));
    expect(created.id).toBe('driver-new');
    expect(created.status).toBe('PENDING_VERIFICATION');
    expect(created.user.email).toBe('t@example.com');
    expect(audit.log).toHaveBeenCalled();
  });

  it('is idempotent: returns the existing profile without creating another', async () => {
    const existing = { id: 'driver-1', userId: 'user-1', status: 'VERIFIED', user: { id: 'user-1' } };
    const { svc, prisma } = makeService({ id: 'user-1', primaryRole: 'DRIVER', driver: { id: 'driver-1' } }, existing);
    const result: any = await svc.provisionDriverProfile('user-1', 'admin-1');
    expect(result.id).toBe('driver-1');
    expect(prisma.driver.create).not.toHaveBeenCalled();
  });

  it('rejects accounts that do not have the Driver role', async () => {
    const { svc } = makeService({ id: 'user-2', primaryRole: 'OWNER', driver: null });
    await expect(svc.provisionDriverProfile('user-2', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown users', async () => {
    const { svc } = makeService(null);
    await expect(svc.provisionDriverProfile('missing', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminService.verifyDriver account-status sync', () => {
  const profile = { id: 'driver-1', userId: 'user-1', status: 'PENDING_VERIFICATION' };

  it('activates the login account when the driver is verified', async () => {
    const { svc, prisma } = makeService({ id: 'user-1', primaryRole: 'DRIVER' }, profile);
    await svc.verifyDriver('driver-1', 'VERIFIED' as any, 'admin-1');
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1', status: { not: 'DEACTIVATED' } },
      data: { status: 'ACTIVE' },
    }));
  });

  it('suspends the login account when the driver is suspended', async () => {
    const { svc, prisma } = makeService({ id: 'user-1', primaryRole: 'DRIVER' }, profile);
    await svc.verifyDriver('driver-1', 'SUSPENDED' as any, 'admin-1');
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'SUSPENDED' } }));
  });

  it('returns the account to pending when the driver is made inactive', async () => {
    const { svc, prisma } = makeService({ id: 'user-1', primaryRole: 'DRIVER' }, profile);
    await svc.verifyDriver('driver-1', 'INACTIVE' as any, 'admin-1');
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PENDING_VERIFICATION' } }));
  });
});
