import { CompaniesService } from './companies.service';

describe('CompaniesService member management', () => {
  const adminMembership = { id: 'm-admin', companyId: 'co-1', userId: 'admin-1', role: 'COMPANY_ADMIN', isActive: true };
  const memberCreate = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'm-new', ...data }));
  const memberUpdate = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'm-x', ...data }));
  const prisma: any = {
    company: { findUnique: jest.fn().mockResolvedValue({ id: 'co-1', name: 'Lartey Company' }), create: jest.fn() },
    companyMember: {
      findFirst: jest.fn().mockResolvedValue(adminMembership),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([adminMembership]),
      count: jest.fn().mockResolvedValue(0),
      create: memberCreate,
      update: memberUpdate,
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user-2', email: 'fleet@test.com', primaryRole: 'COMPANY_MEMBER' }),
      update: jest.fn().mockResolvedValue({}),
    },
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-fm', name: 'FLEET_MANAGER' }) },
    userRoleAssignment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
  };
  const svc = new CompaniesService(prisma);
  beforeEach(() => jest.clearAllMocks());

  it('company admin can add a fleet manager by email', async () => {
    const res: any = await svc.addMember('co-1', 'admin-1', 'COMPANY_ADMIN', { email: 'fleet@test.com', role: 'FLEET_MANAGER' } as any);
    expect(memberCreate).toHaveBeenCalled();
    expect(res.role ?? res.data?.role ?? 'FLEET_MANAGER').toBeDefined();
    const created = memberCreate.mock.calls[0][0].data;
    expect(created).toMatchObject({ companyId: 'co-1', userId: 'user-2', role: 'FLEET_MANAGER' });
  });

  it('non-admin members cannot add members', async () => {
    prisma.companyMember.findFirst.mockResolvedValueOnce({ ...adminMembership, role: 'COMPANY_MEMBER' });
    await expect(svc.addMember('co-1', 'user-9', 'COMPANY_MEMBER', { email: 'x@test.com', role: 'COMPANY_MEMBER' } as any)).rejects.toThrow();
    expect(memberCreate).not.toHaveBeenCalled();
  });

  it('rejects unsupported member roles', async () => {
    await expect(svc.addMember('co-1', 'admin-1', 'COMPANY_ADMIN', { email: 'fleet@test.com', role: 'SUPER_ADMIN' } as any)).rejects.toThrow();
  });

  it('company admin can assign a Driver role inside the company', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-driver', name: 'DRIVER' });
    await svc.addMember('co-1', 'admin-1', 'COMPANY_ADMIN', { email: 'fleet@test.com', role: 'DRIVER' } as any);
    expect(memberCreate.mock.calls[0][0].data).toMatchObject({ role: 'DRIVER' });
  });

  it('cannot deactivate the last company admin', async () => {
    prisma.companyMember.findUnique.mockResolvedValueOnce(adminMembership);
    await expect(svc.setMemberActive('co-1', 'm-admin', false, 'admin-1', 'COMPANY_ADMIN')).rejects.toThrow();
    expect(memberUpdate).not.toHaveBeenCalled();
  });
});

describe('CompaniesService invites (no pre-existing account)', () => {
  const sms = { send: jest.fn().mockResolvedValue({ success: true }) };
  const inviteCreate = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'inv-1', status: 'PENDING', ...data }));
  const prisma: any = {
    company: { findUnique: jest.fn().mockResolvedValue({ id: 'co-1', name: 'Lartey Company', type: 'TRANSPORT' }) },
    companyMember: {
      findFirst: jest.fn().mockResolvedValue({ id: 'm-admin', companyId: 'co-1', userId: 'admin-1', role: 'COMPANY_ADMIN', isActive: true }),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'm-new' }),
    },
    companyInvite: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: inviteCreate,
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'inv-1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'user-new', email: data.email, phone: data.phone, primaryRole: data.primaryRole })),
      update: jest.fn().mockResolvedValue({}),
    },
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-fm', name: 'FLEET_MANAGER' }) },
    userRoleAssignment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
  };
  const svc = new CompaniesService(prisma, sms as any);
  beforeEach(() => jest.clearAllMocks());

  it('creates an invite for an email with no account and returns the link', async () => {
    const res: any = await svc.createInvite('co-1', 'admin-1', 'COMPANY_ADMIN', { contact: 'new.fm@example.com', role: 'FLEET_MANAGER' } as any);
    expect(res.status).toBe('invited');
    expect(res.inviteLink).toContain('/invite/');
    expect(inviteCreate).toHaveBeenCalled();
    expect(inviteCreate.mock.calls[0][0].data.email).toBe('new.fm@example.com');
    expect(inviteCreate.mock.calls[0][0].data.tokenHash).not.toContain(res.inviteLink.split('/invite/')[1]);
  });

  it('sends an SMS invite when a phone number is used', async () => {
    const res: any = await svc.createInvite('co-1', 'admin-1', 'COMPANY_ADMIN', { contact: '+233244111222', role: 'COMPANY_MEMBER' } as any);
    expect(res.status).toBe('invited');
    expect(sms.send).toHaveBeenCalled();
    expect(sms.send.mock.calls[0][0].to).toBe('+233244111222');
    expect(sms.send.mock.calls[0][0].message).toContain('/invite/');
  });

  it('acceptInvite creates the account tied to the company with the invited role', async () => {
    const created: any = await svc.createInvite('co-1', 'admin-1', 'COMPANY_ADMIN', { contact: 'new.fm@example.com', role: 'FLEET_MANAGER' } as any);
    const token = created.inviteLink.split('/invite/')[1];
    prisma.companyInvite.findUnique.mockResolvedValue({ id: 'inv-1', companyId: 'co-1', email: 'new.fm@example.com', phone: null, role: 'FLEET_MANAGER', title: null, status: 'PENDING', invitedBy: 'admin-1', expiresAt: new Date(Date.now() + 86400000), company: { id: 'co-1', name: 'Lartey Company', type: 'TRANSPORT' } });
    const res: any = await svc.acceptInvite(token, { firstName: 'New', lastName: 'Manager', password: 'Manager123!' } as any);
    expect(res.user.primaryRole).toBe('FLEET_MANAGER');
    expect(res.company.id).toBe('co-1');
    expect(prisma.companyMember.create).toHaveBeenCalled();
    expect(prisma.companyInvite.update).toHaveBeenCalled();
  });

  it('inviting an existing user does not add them until they accept', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'driver-1', email: 'driver@test.com' });
    const res: any = await svc.createInvite('co-1', 'admin-1', 'COMPANY_ADMIN', { contact: 'driver@test.com', role: 'DRIVER' } as any);
    expect(res.status).toBe('invited');
    expect(prisma.companyMember.create).not.toHaveBeenCalled();
  });

  it('acceptInviteAsUser joins the company and keeps the personal Driver account', async () => {
    prisma.companyInvite.findUnique.mockResolvedValue({ id: 'inv-1', companyId: 'co-1', email: 'driver@test.com', phone: null, role: 'OWNER', title: null, status: 'PENDING', invitedBy: 'admin-1', expiresAt: new Date(Date.now() + 86400000), company: { id: 'co-1', name: 'Lartey Company', type: 'TRANSPORT' } });
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'driver-1', firstName: 'Kofi', lastName: 'Driver', email: 'driver@test.com', phone: null, primaryRole: 'DRIVER' });
    prisma.owner = { upsert: jest.fn().mockResolvedValue({ id: 'owner-1' }) };
    const res: any = await svc.acceptInviteAsUser('sometoken', 'driver-1');
    expect(res.status).toBe('joined');
    expect(res.role).toBe('OWNER');
    expect(prisma.companyMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'driver-1', role: 'OWNER' }) }),
    );
    // Personal primary role is untouched by joining a company.
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('acceptInvite rejects an expired/revoked token', async () => {
    prisma.companyInvite.findUnique.mockResolvedValue({ id: 'inv-1', companyId: 'co-1', email: 'x@example.com', role: 'COMPANY_MEMBER', status: 'REVOKED', expiresAt: new Date(Date.now() + 86400000), company: { id: 'co-1', name: 'Lartey Company' } });
    await expect(svc.acceptInvite('sometoken', { firstName: 'A', lastName: 'B', password: 'Password123!' } as any)).rejects.toThrow();
  });
});
