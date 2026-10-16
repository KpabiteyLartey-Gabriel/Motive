jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class MockNotificationsService {},
}));

import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

describe('AuthService password reset', () => {
  let service: AuthService;
  let prisma: any;
  let notifications: any;

  const user = { id: 'user-1', email: 'a@test.com', phone: '+233551234567', firstName: 'Ama', status: 'ACTIVE' };

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn(), update: jest.fn() },
      passwordReset: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn(async (ops: any[]) => ops),
    };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    service = new AuthService(
      prisma,
      {} as any,
      {} as any,
      { get: (_k: string, d: any) => d } as any,
      notifications,
    );
  });

  it('issues a hashed expiring token and notifies without revealing the token', async () => {
    prisma.user.findFirst.mockResolvedValue(user);
    const res = await service.forgotPassword('A@Test.com');

    expect(res.success).toBe(true);
    const created = prisma.passwordReset.create.mock.calls[0][0].data;
    expect(created.userId).toBe('user-1');
    expect(created.token).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex, never the raw token
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
    expect(created.expiresAt.getTime()).toBeLessThan(Date.now() + 61 * 60 * 1000);
    // email + sms + in-app
    expect(notifications.send).toHaveBeenCalledTimes(3);
    const channels = notifications.send.mock.calls.map((c: any[]) => c[0].channel);
    expect(channels).toEqual(['EMAIL', 'SMS', 'IN_APP']);
  });

  it('returns the same generic response for unknown accounts (no enumeration)', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await service.forgotPassword('nobody@test.com');
    expect(res.success).toBe(true);
    expect(prisma.passwordReset.create).not.toHaveBeenCalled();
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('resets the password, burns the token and revokes all sessions', async () => {
    const raw = 'raw-token-123';
    const hash = createHash('sha256').update(raw).digest('hex');
    prisma.passwordReset.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      token: hash,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60 * 1000),
      user: { id: 'user-1', firstName: 'Ama' },
    });
    prisma.user.update.mockResolvedValue({});
    const res = await service.resetPassword(raw, 'NewPass@2026');
    expect(res.success).toBe(true);
    const update = prisma.user.update.mock.calls[0][0];
    expect(await bcrypt.compare('NewPass@2026', update.data.passwordHash)).toBe(true);
    expect(prisma.passwordReset.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'reset-1' }, data: { usedAt: expect.any(Date) } }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(notifications.send).toHaveBeenCalled();
  });

  it('rejects expired, used and unknown tokens', async () => {
    prisma.passwordReset.findUnique.mockResolvedValue({
      id: 'r', userId: 'user-1', usedAt: null, expiresAt: new Date(Date.now() - 1000), user: { id: 'user-1', firstName: 'Ama' },
    });
    await expect(service.resetPassword('x', 'NewPass@2026')).rejects.toThrow(/invalid or has expired/);

    prisma.passwordReset.findUnique.mockResolvedValue({
      id: 'r', userId: 'user-1', usedAt: new Date(), expiresAt: new Date(Date.now() + 1000), user: { id: 'user-1', firstName: 'Ama' },
    });
    await expect(service.resetPassword('x', 'NewPass@2026')).rejects.toThrow(/invalid or has expired/);

    prisma.passwordReset.findUnique.mockResolvedValue(null);
    await expect(service.resetPassword('x', 'NewPass@2026')).rejects.toThrow(/invalid or has expired/);
    await expect(service.resetPassword('x', 'short')).rejects.toThrow(/at least 8/);
  });
});
