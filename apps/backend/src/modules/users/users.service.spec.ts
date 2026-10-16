import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

describe('UsersService account settings', () => {
  let hash: string;
  const update = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'u-1', ...data }));
  const revoke = jest.fn().mockResolvedValue({ count: 2 });
  let prisma: any;
  let svc: UsersService;

  beforeAll(async () => { hash = await bcrypt.hash('OldPass123!', 4); });
  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u-1', email: 'fm@test.com', passwordHash: hash, primaryRole: 'FLEET_MANAGER', status: 'ACTIVE', deletedAt: null }),
        update,
      },
      refreshToken: { updateMany: revoke },
    };
    svc = new UsersService(prisma);
  });

  it('updateProfile changes only profile fields', async () => {
    await svc.updateProfile('u-1', { firstName: 'Kofi', phone: '+233200000000', primaryRole: 'ADMIN' } as any);
    const data = update.mock.calls[0][0].data;
    expect(data.firstName).toBe('Kofi');
    expect(data.primaryRole).toBeUndefined();
    expect(data.status).toBeUndefined();
  });

  it('changePassword rejects a wrong current password', async () => {
    await expect(svc.changePassword('u-1', 'nope', 'NewPass123!')).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it('changePassword updates the hash and revokes refresh tokens', async () => {
    const res: any = await svc.changePassword('u-1', 'OldPass123!', 'NewPass123!');
    expect(res.success).toBe(true);
    const data = update.mock.calls[0][0].data;
    await expect(bcrypt.compare('NewPass123!', data.passwordHash)).resolves.toBe(true);
    expect(revoke).toHaveBeenCalled();
  });

  it('changePassword enforces a minimum length', async () => {
    await expect(svc.changePassword('u-1', 'OldPass123!', 'short')).rejects.toThrow();
  });

  it('deactivateMyAccount sets DEACTIVATED and revokes tokens', async () => {
    const res: any = await svc.deactivateMyAccount('u-1');
    expect(res.status).toBe('DEACTIVATED');
    expect(revoke).toHaveBeenCalled();
  });
});
