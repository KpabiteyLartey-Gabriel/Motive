jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class MockNotificationsService {},
}));

import { AuthService } from './auth.service';

describe('AuthService Continue with Google', () => {
  it('creates a PENDING account for a new Google user so account type is step 2', async () => {
    const created: any[] = [];
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => { const u = { id: 'g-1', phone: null, ...data }; created.push(u); return u; }),
        update: jest.fn(async ({ data }: any) => ({ id: 'g-1', ...data })),
      },
      userRoleAssignment: { findMany: jest.fn(async () => []) },
      refreshToken: { create: jest.fn(async () => ({})) },
    };
    const svc = new AuthService(prisma, {} as any, { sign: () => 'access-token' } as any, { get: (_k: string, d: any) => d } as any, { send: jest.fn() } as any);
    svc.verifyGoogleIdToken = jest.fn(async () => ({ sub: 'google-123', email: 'ama@gmail.com', email_verified: 'true', given_name: 'Ama', family_name: 'Serwaa', picture: null }));
    const res: any = await svc.googleLogin('fake-id-token');
    expect(created[0].primaryRole).toBe('PENDING');
    expect(created[0].googleId).toBe('google-123');
    expect(created[0].passwordHash).toBeNull();
    expect(res.isNewUser).toBe(true);
    expect(res.accessToken).toBe('access-token');
    expect(res.user.passwordHash).toBeUndefined();
  });

  it('sends the same welcome notifications to a new Google user as a manual signup', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => ({ id: 'g-2', phone: null, ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 'g-2', ...data })),
      },
      userRoleAssignment: { findMany: jest.fn(async () => []) },
      refreshToken: { create: jest.fn(async () => ({})) },
    };
    const send = jest.fn(async (_params: any) => ({}));
    const svc = new AuthService(prisma, {} as any, { sign: () => 'access-token' } as any, { get: (_k: string, d: any) => d } as any, { send } as any);
    svc.verifyGoogleIdToken = jest.fn(async () => ({ sub: 'google-9', email: 'kwame@gmail.com', email_verified: 'true', given_name: 'Kwame', family_name: 'Mensah', picture: null }));
    await svc.googleLogin('fake-id-token');
    await new Promise((r) => setImmediate(r));
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'g-2', channel: 'IN_APP', type: 'WELCOME', subject: 'Welcome to +Motive' }));
    expect(send.mock.calls[0][0].body).toContain('Hello Kwame');
  });

  it('links Google to an existing password account with the same email', async () => {
    const existing = { id: 'user-1', email: 'ama@gmail.com', phone: null, googleId: null, primaryRole: 'OWNER', status: 'ACTIVE', passwordHash: 'hash', profilePhotoUrl: null, emailVerifiedAt: null };
    const prisma: any = {
      user: {
        findUnique: jest.fn(async ({ where }: any) => (where.email === existing.email ? existing : null)),
        update: jest.fn(async ({ data }: any) => ({ ...existing, ...data })),
      },
      userRoleAssignment: { findMany: jest.fn(async () => [{ role: { name: 'OWNER' } }]) },
      refreshToken: { create: jest.fn(async () => ({})) },
    };
    const svc = new AuthService(prisma, {} as any, { sign: () => 'access-token' } as any, { get: (_k: string, d: any) => d } as any, { send: jest.fn() } as any);
    svc.verifyGoogleIdToken = jest.fn(async () => ({ sub: 'google-123', email: 'ama@gmail.com', email_verified: 'true' }));
    const res: any = await svc.googleLogin('fake-id-token');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ googleId: 'google-123' }) }));
    expect(res.isNewUser).toBe(false);
    expect(res.user.primaryRole).toBe('OWNER');
  });
});
