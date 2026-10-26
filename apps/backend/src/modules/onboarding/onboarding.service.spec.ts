import { BadRequestException, ConflictException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AccountType } from './dto/onboarding.dto';

function makePrisma(user: any) {
  const state: any = {
    user,
    driver: user?.driver || null,
    owner: user?.owner || null,
  };
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => ({
        ...state.user,
        driver: state.driver,
        owner: state.owner,
      })),
      update: jest.fn(async ({ data }: any) => { Object.assign(state.user, data); return state.user; }),
      updateMany: jest.fn(async ({ data }: any) => { Object.assign(state.user, data); return { count: 1 }; }),
    },
    role: { findUnique: jest.fn(async ({ where }: any) => ({ id: `role-${where.name}`, name: where.name })) },
    userRoleAssignment: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async ({ data }: any) => data),
    },
    driver: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.userId) return state.driver;
        if (where.ghanaCardNumber) return state.driver?.ghanaCardNumber === where.ghanaCardNumber ? state.driver : null;
        if (where.licenseNumber) return state.driver?.licenseNumber === where.licenseNumber ? state.driver : null;
        return null;
      }),
      upsert: jest.fn(async ({ create, update }: any) => {
        state.driver = state.driver ? { ...state.driver, ...update } : { id: 'driver-1', status: 'PENDING_VERIFICATION', ...create };
        return state.driver;
      }),
      update: jest.fn(async ({ data }: any) => { Object.assign(state.driver, data); return state.driver; }),
    },
    owner: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.userId) return state.owner;
        if (where.ghanaCardNumber) return state.owner?.ghanaCardNumber === where.ghanaCardNumber ? state.owner : null;
        return null;
      }),
      upsert: jest.fn(async ({ create, update }: any) => {
        state.owner = state.owner ? { ...state.owner, ...update } : { id: 'owner-1', status: 'PENDING_VERIFICATION', ...create };
        return state.owner;
      }),
      update: jest.fn(async ({ data }: any) => { Object.assign(state.owner, data); return state.owner; }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return { prisma, state };
}

const baseUser = { id: 'user-1', firstName: 'Kofi', lastName: 'Mensah', email: 'kofi@test.com', phone: null, primaryRole: 'PENDING', status: 'PENDING_VERIFICATION', authProvider: 'LOCAL', onboardingCompletedAt: null };

describe('OnboardingService', () => {
  it('starts a PENDING account at the account-type step', async () => {
    const { prisma } = makePrisma({ ...baseUser });
    const svc = new OnboardingService(prisma);
    const state = await svc.getState('user-1');
    expect(state.accountType).toBeNull();
    expect(state.nextStep).toBe('accountType');
    expect(state.completed).toBe(false);
  });

  it('choosing Owner creates the owner profile and moves to National ID', async () => {
    const { prisma, state } = makePrisma({ ...baseUser });
    const svc = new OnboardingService(prisma);
    const after = await svc.setAccountType('user-1', AccountType.OWNER);
    expect(state.user.primaryRole).toBe('OWNER');
    expect(state.owner).toBeTruthy();
    expect(after.nextStep).toBe('nationalId');
  });

  it('owner finishes after submitting a National ID (pending review still counts as submitted)', async () => {
    const { prisma } = makePrisma({ ...baseUser, primaryRole: 'OWNER', owner: { id: 'owner-1', userId: 'user-1', status: 'PENDING_VERIFICATION', ghanaCardNumber: null } });
    const svc = new OnboardingService(prisma);
    const after = await svc.submitNationalId('user-1', 'GHA-123456789-0');
    expect(after.nationalId.status).toBe('PENDING_REVIEW');
    expect(after.completed).toBe(true);
    expect(after.verified).toBe(false);
  });

  it('driver must also submit a licence before onboarding is complete', async () => {
    const driver = { id: 'driver-1', userId: 'user-1', status: 'PENDING_VERIFICATION', ghanaCardNumber: 'GHA-1', licenseNumber: null };
    const { prisma } = makePrisma({ ...baseUser, primaryRole: 'DRIVER', driver });
    const svc = new OnboardingService(prisma);
    const before = await svc.getState('user-1');
    expect(before.completed).toBe(false);
    expect(before.nextStep).toBe('licence');
    const after = await svc.submitDriverLicence('user-1', { licenseNumber: 'GH-999', licenseClass: 'Class B' });
    expect(after.licence.status).toBe('PENDING_REVIEW');
    expect(after.completed).toBe(true);
  });

  it('owners cannot submit a driver licence and a taken Ghana Card is rejected', async () => {
    const { prisma } = makePrisma({ ...baseUser, primaryRole: 'OWNER', owner: { id: 'owner-1', userId: 'user-1', ghanaCardNumber: null } });
    const svc = new OnboardingService(prisma);
    await expect(svc.submitDriverLicence('user-1', { licenseNumber: 'GH-1' })).rejects.toBeInstanceOf(BadRequestException);

    const other = makePrisma({ ...baseUser, primaryRole: 'OWNER', owner: { id: 'owner-1', userId: 'user-1', ghanaCardNumber: null } });
    other.prisma.owner.findUnique = jest.fn(async ({ where }: any) => (where.ghanaCardNumber === 'GHA-999999999-9' ? { id: 'owner-2', userId: 'user-2', ghanaCardNumber: 'GHA-999999999-9' } : other.state.owner));
    const svc2 = new OnboardingService(other.prisma);
    await expect(svc2.submitNationalId('user-1', 'GHA-999999999-9')).rejects.toBeInstanceOf(ConflictException);
  });

  it('National ID must be in the Ghana Card format GHA-000000000-0', async () => {
    const { prisma } = makePrisma({ ...baseUser, primaryRole: 'OWNER', owner: { id: 'owner-1', userId: 'user-1', ghanaCardNumber: null } });
    const svc = new OnboardingService(prisma);
    await expect(svc.submitNationalId('user-1', 'GHA-1')).rejects.toThrow(/Ghana Card format GHA-000000000-0/);
    await expect(svc.submitNationalId('user-1', 'GHA-TAKEN')).rejects.toThrow(/Ghana Card format/);
    // Typed without dashes, it is stored in the canonical format.
    const after = await svc.submitNationalId('user-1', 'gha1234567890');
    expect(after.nationalId.ghanaCardNumber).toBe('GHA-123456789-0');
  });
});
