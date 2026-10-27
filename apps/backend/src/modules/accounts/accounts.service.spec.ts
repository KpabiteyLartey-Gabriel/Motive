import { AccountsService } from './accounts.service';

function makeSvc(user: any) {
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({}),
    },
    driver: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'driver-1', ...data })),
      upsert: jest.fn().mockResolvedValue({ id: 'driver-1' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    owner: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'owner-1', ...data })),
      upsert: jest.fn().mockResolvedValue({ id: 'owner-1' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    serviceProvider: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sp-1', ...data })),
    },
    identityVerification: {
      upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'iv-1', ...create })),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    licenceVerification: {
      upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'lv-1', ...create })),
    },
    accountCreationOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'order-1', status: 'COMPLETED' }) },
    company: { create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'co-1', ...data })) },
    companyMember: { create: jest.fn().mockResolvedValue({ id: 'm-1' }) },
    role: { findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({ id: `role-${where.name}`, name: where.name })) },
    userRoleAssignment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const storage: any = { uploadFile: jest.fn(async (file: any) => ({ url: `https://cdn.example/${file.originalname}`, fileName: file.originalname })) };
  return { svc: new AccountsService(prisma, storage), prisma, storage };
}

const plainUser = {
  id: 'u-1', firstName: 'Ama', lastName: 'Test', email: 'ama@test.com', phone: null,
  primaryRole: 'PENDING', status: 'ACTIVE', emailVerifiedAt: new Date(),
  driver: null, owner: null, serviceProvider: null, companyMembers: [],
};

describe('AccountsService multi-account rules', () => {
  it('a plain user can create Driver, Owner, Service Provider and Company accounts', async () => {
    const { svc } = makeSvc({ ...plainUser });
    const state: any = await svc.getMyAccounts('u-1');
    expect(state.canCreateCompany).toBe(true);
    expect(state.accounts.map((a: any) => a.kind)).toEqual(['DRIVER', 'OWNER', 'SERVICE_PROVIDER', 'COMPANY']);
    expect(state.accounts.every((a: any) => a.status === 'NOT_CREATED')).toBe(true);
  });

  it('creating a Driver account does not remove an existing Owner account', async () => {
    const user = { ...plainUser, owner: { id: 'owner-1', ghanaCardNumber: 'GHA-1', nationalIdVerifiedAt: new Date(), verifiedAt: null } };
    const { svc, prisma } = makeSvc(user);
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValue({ ...user, driver: { id: 'driver-1', ghanaCardNumber: null, licenseNumber: null } });
    const state: any = await svc.createDriver('u-1');
    expect(prisma.driver.create).toHaveBeenCalled();
    expect(prisma.userRoleAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u-1' }) }),
    );
    const owner = state.accounts.find((a: any) => a.kind === 'OWNER');
    expect(owner.status).toBe('VERIFIED');
  });

  it('a Driver cannot create a Company account', async () => {
    const user = { ...plainUser, driver: { id: 'driver-1', ghanaCardNumber: 'GHA-1', licenseNumber: 'LIC-1', nationalIdVerifiedAt: new Date(), licenceVerifiedAt: new Date() } };
    const { svc, prisma } = makeSvc(user);
    await expect(svc.createCompany('u-1', { name: 'Nope Ltd' } as any)).rejects.toThrow(/Driver, Owner or Service Provider/);
    expect(prisma.company.create).not.toHaveBeenCalled();
  });

  it('a plain user creating a Company becomes its Company Admin', async () => {
    const { svc, prisma } = makeSvc({ ...plainUser });
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...plainUser })
      .mockResolvedValue({
        ...plainUser, primaryRole: 'COMPANY_ADMIN',
        companyMembers: [{ id: 'm-1', role: 'COMPANY_ADMIN', title: null, joinedAt: new Date(), company: { id: 'co-1', name: 'Ama Transport', type: 'TRANSPORT', status: 'ACTIVE' } }],
      });
    const state: any = await svc.createCompany('u-1', { name: 'Ama Transport' } as any);
    expect(prisma.companyMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u-1', role: 'COMPANY_ADMIN' }) }),
    );
    expect(state.memberships[0]).toMatchObject({ companyName: 'Ama Transport', role: 'COMPANY_ADMIN' });
  });

  it('National ID submissions must use the Ghana Card format and are stored canonically', async () => {
    const { svc, prisma } = makeSvc({ ...plainUser });
    await expect(svc.submitNationalId('u-1', 'DRIVER', 'GHA-1')).rejects.toThrow(/Ghana Card format GHA-000000000-0/);
    await svc.submitNationalId('u-1', 'DRIVER', 'gha1234567890');
    expect(prisma.driver.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ ghanaCardNumber: 'GHA-123456789-0' }) }),
    );
  });

  it('identity verification requires card front, back and a live camera capture', async () => {
    const { svc } = makeSvc({ ...plainUser });
    const f = (n: string) => ({ originalname: n, mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('x') });
    await expect(svc.submitIdentityVerification('u-1', 'DRIVER', 'GHA-123456789-0', {} as any)).rejects.toThrow(/front and back/);
    await expect(
      svc.submitIdentityVerification('u-1', 'DRIVER', 'GHA-123456789-0', { idFront: f('f.jpg'), idBack: f('b.jpg') } as any),
    ).rejects.toThrow(/live camera/);
    await expect(
      svc.submitIdentityVerification('u-1', 'DRIVER', 'GHA-1', { idFront: f('f.jpg'), idBack: f('b.jpg'), selfie: f('s.jpg') } as any),
    ).rejects.toThrow(/Ghana Card format/);
  });

  it('identity verification stores all three images as PENDING_REVIEW, never auto-approved', async () => {
    const { svc, prisma } = makeSvc({ ...plainUser });
    prisma.user.findUnique.mockResolvedValue({
      ...plainUser,
      driver: { id: 'driver-1', ghanaCardNumber: 'GHA-123456789-0', licenseNumber: 'LIC-1', nationalIdVerifiedAt: null, licenceVerifiedAt: null },
      identityVerifications: [{ accountKind: 'DRIVER', status: 'PENDING_REVIEW', ghanaCardNumber: 'GHA-123456789-0', updatedAt: new Date() }],
    });
    const f = (n: string) => ({ originalname: n, mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('x') });
    const state: any = await svc.submitIdentityVerification(
      'u-1', 'DRIVER', 'gha1234567890',
      { idFront: f('front.jpg'), idBack: f('back.jpg'), selfie: f('selfie.jpg') } as any,
      'turn-left,smile',
    );
    expect(prisma.identityVerification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ghanaCardNumber: 'GHA-123456789-0', status: 'PENDING_REVIEW',
          idFrontUrl: 'https://cdn.example/front.jpg', idBackUrl: 'https://cdn.example/back.jpg',
          livenessSelfieUrl: 'https://cdn.example/selfie.jpg',
        }),
      }),
    );
    const driver = state.accounts.find((a: any) => a.kind === 'DRIVER');
    expect(driver.identityVerification.status).toBe('PENDING_REVIEW');
  });

  it('Phase 2 (licence) stays locked until Phase 1 identity is submitted', async () => {
    const { svc, prisma } = makeSvc({ ...plainUser });
    const f = (n: string) => ({ originalname: n, mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('x') });
    await expect(
      svc.submitLicenceVerification('u-1', { licenseNumber: 'LIC-1' }, { licenceFront: f('lf.jpg'), licenceBack: f('lb.jpg') }),
    ).rejects.toThrow(/Phase 1 first/);
    prisma.identityVerification.findUnique.mockResolvedValue({ id: 'iv-1', status: 'PENDING_REVIEW', livenessPassed: true });
    prisma.user.findUnique.mockResolvedValue({
      ...plainUser,
      driver: { id: 'driver-1', ghanaCardNumber: 'GHA-123456789-0', licenseNumber: 'LIC-1' },
      identityVerifications: [{ accountKind: 'DRIVER', status: 'PENDING_REVIEW', ghanaCardNumber: 'GHA-123456789-0', livenessPassed: true, updatedAt: new Date() }],
      licenceVerification: { status: 'PENDING_REVIEW', licenseNumber: 'LIC-1', updatedAt: new Date() },
    });
    const state: any = await svc.submitLicenceVerification('u-1', { licenseNumber: 'LIC-1' }, { licenceFront: f('lf.jpg'), licenceBack: f('lb.jpg') });
    expect(prisma.licenceVerification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: 'PENDING_REVIEW', licenseNumber: 'LIC-1' }) }),
    );
    const driver = state.accounts.find((a: any) => a.kind === 'DRIVER');
    expect(driver.licenceVerification.status).toBe('PENDING_REVIEW');
  });

  it('Service Provider account is active immediately with no verification', async () => {
    const { svc, prisma } = makeSvc({ ...plainUser });
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...plainUser })
      .mockResolvedValue({ ...plainUser, serviceProvider: { id: 'sp-1', businessName: 'Ama Auto', serviceType: 'Mechanic', status: 'ACTIVE' } });
    const state: any = await svc.createServiceProvider('u-1', { businessName: 'Ama Auto', serviceType: 'Mechanic' } as any);
    const sp = state.accounts.find((a: any) => a.kind === 'SERVICE_PROVIDER');
    expect(sp.status).toBe('ACTIVE');
  });
});
