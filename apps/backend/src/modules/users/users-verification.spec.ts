import { UsersService } from './users.service';
import { createHash } from 'crypto';

describe('UsersService verification codes', () => {
  let svc: UsersService;
  let prisma: any;
  let messaging: any;

  const user = {
    id: 'user-1', email: 'ama@test.com', phone: '+233551234567',
    emailVerifiedAt: null, phoneVerifiedAt: null, deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ ...user }), update: jest.fn().mockResolvedValue({}) },
      verificationCode: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (ops: any[]) => ops),
    };
    messaging = {
      sendEmail: jest.fn().mockResolvedValue({ delivered: true }),
      sendSms: jest.fn().mockResolvedValue({ delivered: true }),
    };
    svc = new UsersService(prisma, messaging);
  });

  it('sends a hashed 6-digit email code that expires in 10 minutes', async () => {
    const res = await svc.sendVerificationCode('user-1', 'email');
    expect(res.success).toBe(true);
    const created = prisma.verificationCode.create.mock.calls[0][0].data;
    expect(created.type).toBe('EMAIL_VERIFY');
    expect(created.code).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash, never the raw code
    expect(created.code).not.toMatch(/^\d{6}$/);
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
    expect(created.expiresAt.getTime()).toBeLessThan(Date.now() + 11 * 60 * 1000);
    expect(messaging.sendEmail).toHaveBeenCalledWith('ama@test.com', expect.any(String), expect.stringContaining('verification code'));
    expect(messaging.sendSms).not.toHaveBeenCalled();
  });

  it('sends phone codes by SMS only', async () => {
    await svc.sendVerificationCode('user-1', 'phone');
    expect(prisma.verificationCode.create.mock.calls[0][0].data.type).toBe('PHONE_VERIFY');
    expect(messaging.sendSms).toHaveBeenCalledWith('+233551234567', expect.stringContaining('verification code'));
    expect(messaging.sendEmail).not.toHaveBeenCalled();
  });

  it('reports already-verified channels without sending a code', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, emailVerifiedAt: new Date() });
    const res = await svc.sendVerificationCode('user-1', 'email');
    expect(res.alreadyVerified).toBe(true);
    expect(prisma.verificationCode.create).not.toHaveBeenCalled();
    expect(messaging.sendEmail).not.toHaveBeenCalled();
  });

  it('confirms the right code and stamps emailVerifiedAt', async () => {
    const hash = createHash('sha256').update('123456').digest('hex');
    prisma.verificationCode.findFirst.mockResolvedValue({
      id: 'vc-1', code: hash, usedAt: null, expiresAt: new Date(Date.now() + 60 * 1000),
    });
    const res = await svc.confirmVerificationCode('user-1', 'email', '123456');
    expect(res.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { emailVerifiedAt: expect.any(Date) } }),
    );
    expect(prisma.verificationCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'vc-1' }, data: { usedAt: expect.any(Date) } }),
    );
  });

  it('rejects wrong, expired and malformed codes', async () => {
    const hash = createHash('sha256').update('123456').digest('hex');
    prisma.verificationCode.findFirst.mockResolvedValue({
      id: 'vc-1', code: hash, usedAt: null, expiresAt: new Date(Date.now() + 60 * 1000),
    });
    await expect(svc.confirmVerificationCode('user-1', 'email', '654321')).rejects.toThrow(/incorrect or has expired/);

    prisma.verificationCode.findFirst.mockResolvedValue({
      id: 'vc-1', code: hash, usedAt: null, expiresAt: new Date(Date.now() - 1000),
    });
    await expect(svc.confirmVerificationCode('user-1', 'email', '123456')).rejects.toThrow(/incorrect or has expired/);

    await expect(svc.confirmVerificationCode('user-1', 'email', '12345')).rejects.toThrow(/6-digit/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('OwnersService.updateProfile', () => {
  it('whitelists owner fields and never touches verification status', async () => {
    const { OwnersService } = require('../owners/owners.service');
    const prisma: any = {
      owner: {
        findUnique: jest.fn().mockResolvedValue({ id: 'own-1', userId: 'user-1', status: 'PENDING_VERIFICATION' }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
    };
    const svc = new OwnersService(prisma);
    svc.getProfile = jest.fn().mockResolvedValue({ id: 'own-1' });
    await svc.updateProfile('user-1', { momoNumber: '+233241234567', status: 'VERIFIED', verifiedAt: new Date() });
    const data = prisma.owner.update.mock.calls[0][0].data;
    expect(data).toEqual({ momoNumber: '+233241234567' });
    expect(data.status).toBeUndefined();
  });
});
