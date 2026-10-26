import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

function makeService() {
  const user: any = {
    id: 'user-1', firstName: 'Test', lastName: 'Driver', email: 'test-driver@example.com', phone: null,
    status: 'PENDING_VERIFICATION', authProvider: 'LOCAL', onboardingCompletedAt: null, primaryRole: 'DRIVER',
    createdAt: new Date(),
    driver: { id: 'driver-1', userId: 'user-1', status: 'PENDING_VERIFICATION', ghanaCardNumber: null, licenseNumber: null, nationalIdVerifiedAt: null, licenceVerifiedAt: null, createdAt: new Date() },
    owner: null,
  };
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => user),
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async ({ data }: any) => { Object.assign(user, data); return { count: 1 }; }),
    },
    driver: {
      findMany: jest.fn(async () => [{ ...user.driver, user }]),
      update: jest.fn(async ({ data }: any) => { Object.assign(user.driver, data); return user.driver; }),
    },
    owner: { findMany: jest.fn(async () => []) },
    identityVerification: {
      findMany: jest.fn(async () => [{
        id: 'iv-1', userId: 'user-1', accountKind: 'DRIVER', ghanaCardNumber: 'GHA-123456789-0',
        idFrontUrl: 'https://cdn.example/front.jpg', idBackUrl: 'https://cdn.example/back.jpg',
        livenessSelfieUrl: 'https://cdn.example/selfie.jpg', livenessPassed: true,
        livenessChallenge: 'Look straight', livenessCapturedAt: new Date(), status: 'PENDING_REVIEW',
        createdAt: new Date(), updatedAt: new Date(),
      }]),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    licenceVerification: {
      findMany: jest.fn(async () => [{
        id: 'lv-1', userId: 'user-1', licenseNumber: 'LIC-1',
        licenceFrontUrl: 'https://cdn.example/licence-front.jpg', licenceBackUrl: 'https://cdn.example/licence-back.jpg',
        status: 'PENDING_REVIEW', createdAt: new Date(), updatedAt: new Date(),
      }]),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const audit: any = { log: jest.fn(async () => null) };
  const notifications: any = { send: jest.fn(async () => ({ id: 'n-1' })) };
  return { svc: new AdminService(prisma, audit, notifications), prisma, audit, notifications, user };
}

describe('AdminService manual verification (Super Admin)', () => {
  it('verifies a test driver with no documents when verifying ALL', async () => {
    const { svc, user, audit } = makeService();
    const row: any = await svc.manualVerifyUser('user-1', { target: 'ALL', verified: true }, 'super-1');
    expect(user.driver.nationalIdVerifiedAt).toBeInstanceOf(Date);
    expect(user.driver.licenceVerifiedAt).toBeInstanceOf(Date);
    expect(user.driver.status).toBe('VERIFIED');
    expect(user.status).toBe('ACTIVE');
    expect(row.fullyVerified).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ resource: 'user-verification', newData: expect.objectContaining({ manual: true }) }));
  });

  it('the queue carries the submitted images so the reviewer can see them', async () => {
    const { svc } = makeService();
    const { verifications } = await svc.listVerifications({});
    const row: any = verifications.find((r: any) => r.userId === 'user-1');
    expect(row.identityVerification).toMatchObject({
      idFrontUrl: 'https://cdn.example/front.jpg',
      idBackUrl: 'https://cdn.example/back.jpg',
      livenessSelfieUrl: 'https://cdn.example/selfie.jpg',
      livenessPassed: true,
    });
    expect(row.licenceVerification).toMatchObject({
      licenceFrontUrl: 'https://cdn.example/licence-front.jpg',
      licenceBackUrl: 'https://cdn.example/licence-back.jpg',
    });
  });

  it('manual approval also marks the submitted records APPROVED', async () => {
    const { svc, prisma } = makeService();
    await svc.manualVerifyUser('user-1', { target: 'ALL', verified: true }, 'super-1');
    expect(prisma.identityVerification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
    );
    expect(prisma.licenceVerification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
    );
  });

  it('a driver account is verifiable even when the primary role is not DRIVER', async () => {
    const { svc, prisma, user } = makeService();
    user.primaryRole = 'PENDING';
    const row: any = await svc.manualVerifyUser('user-1', { target: 'ALL', verified: true }, 'super-1');
    expect(row.fullyVerified).toBe(true);
    expect(prisma.driver.update).toHaveBeenCalled();
  });

  it('requesting resubmission rejects the documents, stores the reason, and notifies by email + in-app', async () => {
    const { svc, prisma, notifications } = makeService();
    await svc.requestResubmission('user-1', { target: 'IDENTITY', reason: 'Back of the Ghana Card is blurry' }, 'super-1');
    expect(prisma.identityVerification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }),
    );
    expect(prisma.identityVerification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reviewNote: 'Back of the Ghana Card is blurry' }) }),
    );
    const channels = notifications.send.mock.calls.map((c: any) => c[0].channel);
    expect(channels).toContain('IN_APP');
    expect(channels).toContain('EMAIL');
    expect(notifications.send.mock.calls[0][0].body).toContain('Back of the Ghana Card is blurry');
    await expect(svc.requestResubmission('user-1', { target: 'ALL', reason: ' ' }, 'super-1')).rejects.toThrow(/what is wrong/);
  });

  it('verifying only the licence leaves the driver not fully verified', async () => {
    const { svc, user } = makeService();
    await svc.manualVerifyUser('user-1', { target: 'LICENCE', verified: true }, 'super-1');
    expect(user.driver.licenceVerifiedAt).toBeInstanceOf(Date);
    expect(user.driver.status).toBe('PENDING_VERIFICATION');
    expect(user.status).toBe('PENDING_VERIFICATION');
  });

  it('un-verifying resets the driver to pending', async () => {
    const { svc, user } = makeService();
    await svc.manualVerifyUser('user-1', { target: 'ALL', verified: true }, 'super-1');
    await svc.manualVerifyUser('user-1', { target: 'ALL', verified: false }, 'super-1');
    expect(user.driver.nationalIdVerifiedAt).toBeNull();
    expect(user.driver.status).toBe('PENDING_VERIFICATION');
  });

  it('refuses to verify a user who has not chosen an account type', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique = jest.fn(async () => ({ id: 'user-9', primaryRole: 'PENDING', driver: null, owner: null }));
    await expect(svc.manualVerifyUser('user-9', { target: 'ALL', verified: true }, 'super-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
