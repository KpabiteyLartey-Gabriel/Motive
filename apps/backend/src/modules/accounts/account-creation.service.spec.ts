import { AccountCreationService } from './account-creation.service';

function makeSvc() {
  const order: any = {
    id: 'order-1', userId: 'u-1', kind: 'DRIVER', amount: 20, currency: 'GHS',
    status: 'PENDING_VERIFICATION', codeHash: null, codeExpiresAt: null,
    verifiedAt: null, paidAt: null, completedAt: null, createdAt: new Date(),
  };
  const prisma: any = {
    systemSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    driver: { findUnique: jest.fn().mockResolvedValue(null) },
    owner: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1', firstName: 'Ama', email: 'ama@test.com', phone: '+233201234567' }) },
    accountCreationOrder: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(order.status === 'COMPLETED' ? null : { ...order })),
      create: jest.fn().mockImplementation(({ data }: any) => { Object.assign(order, data, { amount: Number(data.amount) }); return Promise.resolve({ ...order }); }),
      update: jest.fn().mockImplementation(({ data }: any) => { Object.assign(order, data); return Promise.resolve({ ...order }); }),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...order })),
    },
    payment: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pay-1', ...data })),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'SUCCESSFUL' }),
    },
  };
  const accounts: any = { createDriver: jest.fn().mockResolvedValue({}), createOwner: jest.fn().mockResolvedValue({}) };
  const providerFactory: any = {
    getActiveProvider: jest.fn().mockResolvedValue({
      name: 'MOCK', isDirectPay: true,
      requestCollection: jest.fn().mockResolvedValue({ providerReference: 'MOCK-1', status: 'SUCCESSFUL' }),
      getCollectionStatus: jest.fn().mockResolvedValue({ providerReference: 'MOCK-1', status: 'SUCCESSFUL' }),
    }),
  };
  const notifications: any = { send: jest.fn().mockResolvedValue({}) };
  const svc = new AccountCreationService(prisma, accounts, providerFactory, notifications);
  return { svc, prisma, accounts, notifications, order };
}

describe('AccountCreationService (paid Driver/Owner creation)', () => {
  it('defaults both creation charges to GHS 20 and lets an admin change them', async () => {
    const { svc, prisma } = makeSvc();
    const before = await svc.getCharges();
    expect(before.charges).toEqual([
      { kind: 'DRIVER', label: 'Driver account creation', amountGhs: 20 },
      { kind: 'OWNER', label: 'Owner account creation', amountGhs: 20 },
    ]);
    await svc.setCharge('DRIVER', 35, 'admin-1');
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'charges.driver_account_creation_ghs' }, update: expect.objectContaining({ value: '35' }) }),
    );
    await expect(svc.setCharge('OWNER', 0, 'admin-1')).rejects.toThrow(/positive/);
  });

  it('runs start -> confirm -> pay and only then provisions the account', async () => {
    const { svc, accounts, notifications } = makeSvc();

    const started = await svc.start('u-1', 'driver');
    expect(started.status).toBe('PENDING_VERIFICATION');
    expect(started.amount).toBe(20);
    expect(started.sentTo).toEqual(expect.arrayContaining(['phone', 'email', 'in-app']));

    const codeCall = notifications.send.mock.calls.find((c: any[]) => c[0].type === 'ACCOUNT_CREATION_CODE');
    const code = codeCall[0].body.match(/\b\d{6}\b/)[0];

    await expect(svc.pay('u-1', 'DRIVER', { payerPhone: '0244000000' })).rejects.toThrow(/Confirm your interest/);
    await expect(svc.confirm('u-1', 'DRIVER', '000000')).rejects.toThrow(/incorrect or has expired/);

    const confirmed = await svc.confirm('u-1', 'DRIVER', code);
    expect(confirmed.status).toBe('AWAITING_PAYMENT');
    expect(accounts.createDriver).not.toHaveBeenCalled();

    const paid = await svc.pay('u-1', 'DRIVER', { payerPhone: '0244000000' });
    expect(paid.status).toBe('COMPLETED');
    expect(paid.paymentStatus).toBe('SUCCESSFUL');
    expect(accounts.createDriver).toHaveBeenCalledWith('u-1');

    const createdNotice = notifications.send.mock.calls.filter((c: any[]) => c[0].type === 'ACCOUNT_CREATED');
    expect(createdNotice.map((c: any[]) => c[0].channel).sort()).toEqual(['EMAIL', 'IN_APP']);
    expect(createdNotice[0][0].body).toMatch(/sign out and sign back in/);
  });

  it('refuses to start when the account already exists', async () => {
    const { svc, prisma } = makeSvc();
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
    await expect(svc.start('u-1', 'DRIVER')).rejects.toThrow(/already have a Driver account/);
  });
});
