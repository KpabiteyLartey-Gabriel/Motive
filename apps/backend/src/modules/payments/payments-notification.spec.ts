jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class MockNotificationsService {},
}));

import { PaymentsService } from './payments.service';

describe('PaymentsService payment notifications', () => {
  it('notifies the owner on PUSH, IN_APP and EMAIL and confirms the driver', async () => {
    const prisma: any = {
      vehicle: { findUnique: jest.fn().mockResolvedValue({ registrationNumber: 'GR-1234-24', make: 'Toyota', model: 'Corolla' }) },
      owner: { findUnique: jest.fn().mockResolvedValue({ userId: 'owner-user', user: { firstName: 'Kofi' } }) },
      driver: { findUnique: jest.fn().mockResolvedValue({ userId: 'driver-user', user: { firstName: 'Yaw' } }) },
    };
    const notifications = { send: jest.fn().mockResolvedValue({}) };
    const svc = new PaymentsService(prisma, {} as any, {} as any, notifications as any);

    await (svc as any).notifyPaymentReceived({
      id: 'pay-1', contractId: 'contract-1', vehicleId: 'veh-1',
      ownerId: 'owner-1', driverId: 'driver-1', amount: 450,
    });

    const ownerCalls = notifications.send.mock.calls.filter((c: any[]) => c[0].userId === 'owner-user');
    expect(ownerCalls.map((c: any[]) => c[0].channel)).toEqual(['PUSH', 'IN_APP', 'EMAIL']);
    expect(ownerCalls[0][0].type).toBe('PAYMENT_RECEIVED');
    expect(ownerCalls[0][0].body).toContain('GHS 450');
    expect(ownerCalls[0][0].body).toContain('Toyota Corolla (GR-1234-24)');

    const driverCalls = notifications.send.mock.calls.filter((c: any[]) => c[0].userId === 'driver-user');
    expect(driverCalls.map((c: any[]) => c[0].channel)).toEqual(['PUSH', 'IN_APP']);
    expect(driverCalls[0][0].type).toBe('PAYMENT_CONFIRMED');
  });

  it('stays silent when the notifications service is unavailable', async () => {
    const prisma: any = { vehicle: { findUnique: jest.fn() }, owner: { findUnique: jest.fn() }, driver: { findUnique: jest.fn() } };
    const svc = new PaymentsService(prisma, {} as any, {} as any, undefined);
    await expect((svc as any).notifyPaymentReceived({ id: 'p', amount: 10 })).resolves.toBeUndefined();
    expect(prisma.vehicle.findUnique).not.toHaveBeenCalled();
  });
});

describe('AdminService announcements', () => {
  it('sends IN_APP and PUSH to active users of the chosen role only', async () => {
    const { AdminService } = require('../admin/admin.service');
    const prisma: any = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]) },
    };
    const audit = { log: jest.fn().mockResolvedValue({}) };
    const notifications = { sendBulk: jest.fn().mockResolvedValue(undefined) };
    const svc = new AdminService(prisma, audit, notifications);

    const res = await svc.createAnnouncement('admin-1', { subject: 'Hello', body: 'Maintenance on Sunday', role: 'OWNER' });
    expect(res.recipients).toBe(2);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.primaryRole).toBe('OWNER');
    expect(where.deletedAt).toBeNull();
    const channels = notifications.sendBulk.mock.calls.map((c: any[]) => c[1].channel);
    expect(channels).toEqual(['IN_APP', 'PUSH']);
    expect(notifications.sendBulk.mock.calls[0][0]).toEqual(['u1', 'u2']);
    expect(notifications.sendBulk.mock.calls[0][1].type).toBe('ADMIN_ANNOUNCEMENT');
  });

  it('rejects empty announcements', async () => {
    const { AdminService } = require('../admin/admin.service');
    const svc = new AdminService({ user: { findMany: jest.fn() } } as any, { log: jest.fn() } as any, { sendBulk: jest.fn() } as any);
    await expect(svc.createAnnouncement('a', { subject: '', body: 'x' })).rejects.toThrow(/title and a message/);
  });
});
