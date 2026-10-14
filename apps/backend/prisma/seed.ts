import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding GH Motive database...');

  // ── Permissions ────────────────────────────────────────────
  const permissions = [
    // Users
    { name: 'user:read', resource: 'user', action: 'read' },
    { name: 'user:create', resource: 'user', action: 'create' },
    { name: 'user:update', resource: 'user', action: 'update' },
    { name: 'user:delete', resource: 'user', action: 'delete' },
    { name: 'user:suspend', resource: 'user', action: 'suspend' },
    // Vehicles
    { name: 'vehicle:read', resource: 'vehicle', action: 'read' },
    { name: 'vehicle:create', resource: 'vehicle', action: 'create' },
    { name: 'vehicle:update', resource: 'vehicle', action: 'update' },
    { name: 'vehicle:delete', resource: 'vehicle', action: 'delete' },
    { name: 'vehicle:verify', resource: 'vehicle', action: 'verify' },
    { name: 'vehicle:assign', resource: 'vehicle', action: 'assign' },
    // Drivers
    { name: 'driver:read', resource: 'driver', action: 'read' },
    { name: 'driver:create', resource: 'driver', action: 'create' },
    { name: 'driver:update', resource: 'driver', action: 'update' },
    { name: 'driver:verify', resource: 'driver', action: 'verify' },
    { name: 'driver:assign', resource: 'driver', action: 'assign' },
    { name: 'driver:remove', resource: 'driver', action: 'remove' },
    // Contracts
    { name: 'contract:read', resource: 'contract', action: 'read' },
    { name: 'contract:create', resource: 'contract', action: 'create' },
    { name: 'contract:update', resource: 'contract', action: 'update' },
    { name: 'contract:accept', resource: 'contract', action: 'accept' },
    { name: 'contract:terminate', resource: 'contract', action: 'terminate' },
    // Payments
    { name: 'payment:read', resource: 'payment', action: 'read' },
    { name: 'payment:create', resource: 'payment', action: 'create' },
    { name: 'payment:refund', resource: 'payment', action: 'refund' },
    // Maintenance
    { name: 'maintenance:read', resource: 'maintenance', action: 'read' },
    { name: 'maintenance:create', resource: 'maintenance', action: 'create' },
    { name: 'maintenance:update', resource: 'maintenance', action: 'update' },
    { name: 'maintenance:approve', resource: 'maintenance', action: 'approve' },
    // Disputes
    { name: 'dispute:read', resource: 'dispute', action: 'read' },
    { name: 'dispute:create', resource: 'dispute', action: 'create' },
    { name: 'dispute:update', resource: 'dispute', action: 'update' },
    { name: 'dispute:resolve', resource: 'dispute', action: 'resolve' },
    // Admin
    { name: 'admin:read', resource: 'admin', action: 'read' },
    { name: 'admin:manage', resource: 'admin', action: 'manage' },
    { name: 'system:settings', resource: 'system', action: 'settings' },
    { name: 'audit:read', resource: 'audit', action: 'read' },
    { name: 'report:read', resource: 'report', action: 'read' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: { ...perm },
    });
  }
  console.log(`✓ ${permissions.length} permissions created`);

  // ── Roles ──────────────────────────────────────────────────
  const allPermissions = await prisma.permission.findMany();
  const permMap = Object.fromEntries(allPermissions.map((p) => [p.name, p.id]));

  const roles = [
    {
      name: 'DRIVER',
      description: 'Vehicle driver - can view own contracts, make payments, open disputes',
      isSystem: true,
      permissions: [
        'vehicle:read', 'driver:read', 'contract:read', 'contract:accept',
        'payment:read', 'payment:create', 'maintenance:read', 'maintenance:create',
        'dispute:read', 'dispute:create',
      ],
    },
    {
      name: 'OWNER',
      description: 'Vehicle owner - can manage own vehicles, drivers and contracts',
      isSystem: true,
      permissions: [
        'vehicle:read', 'vehicle:create', 'vehicle:update',
        'driver:read', 'driver:assign', 'driver:remove',
        'contract:read', 'contract:create', 'contract:update', 'contract:terminate',
        'payment:read', 'maintenance:read', 'maintenance:approve',
        'dispute:read', 'dispute:create', 'report:read',
      ],
    },
    {
      name: 'COMPANY_ADMIN',
      description: 'Company administrator - full control over company operations',
      isSystem: true,
      permissions: [
        'user:read', 'vehicle:read', 'vehicle:create', 'vehicle:update',
        'driver:read', 'driver:assign', 'driver:remove',
        'contract:read', 'contract:create', 'contract:update', 'contract:terminate',
        'payment:read', 'payment:create',
        'maintenance:read', 'maintenance:create', 'maintenance:update', 'maintenance:approve',
        'dispute:read', 'dispute:create', 'dispute:update', 'report:read',
      ],
    },
    {
      name: 'COMPANY_MEMBER',
      description: 'Company member - limited operational access',
      isSystem: true,
      permissions: [
        'vehicle:read', 'driver:read', 'contract:read',
        'payment:read', 'maintenance:read', 'dispute:read',
      ],
    },
    {
      name: 'FLEET_MANAGER',
      description: 'Fleet manager - manages assigned vehicles and drivers',
      isSystem: true,
      permissions: [
        'vehicle:read', 'vehicle:update',
        'driver:read', 'driver:assign', 'driver:remove',
        'contract:read', 'contract:create', 'contract:update',
        'payment:read', 'maintenance:read', 'maintenance:create',
        'dispute:read', 'report:read',
      ],
    },
    {
      name: 'SERVICE_PROVIDER',
      description: 'Maintenance/service provider - manages assigned jobs',
      isSystem: true,
      permissions: [
        'vehicle:read', 'maintenance:read', 'maintenance:create', 'maintenance:update',
      ],
    },
    {
      name: 'LEGAL_PROFESSIONAL',
      description: 'Legal/dispute resolution professional',
      isSystem: true,
      permissions: [
        'vehicle:read', 'contract:read', 'payment:read',
        'dispute:read', 'dispute:update', 'dispute:resolve',
      ],
    },
    {
      name: 'ADMIN',
      description: 'Platform administrator',
      isSystem: true,
      permissions: [
        'user:read', 'user:update', 'user:suspend',
        'vehicle:read', 'vehicle:verify',
        'driver:read', 'driver:verify',
        'contract:read', 'payment:read', 'payment:refund',
        'maintenance:read', 'dispute:read', 'dispute:update',
        'admin:read', 'audit:read', 'report:read',
      ],
    },
    {
      name: 'SUPER_ADMIN',
      description: 'Super administrator - full platform access',
      isSystem: true,
      permissions: allPermissions.map((p) => p.name),
    },
  ];

  for (const roleData of roles) {
    const { permissions: rolePermNames, ...data } = roleData;
    const role = await prisma.role.upsert({
      where: { name: data.name },
      update: {},
      create: data,
    });

    // Assign permissions
    for (const permName of rolePermNames) {
      const permId = permMap[permName];
      if (permId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        });
      }
    }
  }
  console.log(`✓ ${roles.length} roles created with permissions`);

  // ── Super Admin User ───────────────────────────────────────
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });

  const superAdminUser = await prisma.user.upsert({
    where: { email: 'admin@ghmotive.com' },
    update: {},
    create: {
      email: 'admin@ghmotive.com',
      phone: '+233200000000',
      passwordHash: await bcrypt.hash('Admin@GHMotive2024!', 12),
      firstName: 'GH',
      lastName: 'Motive',
      primaryRole: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  if (superAdminRole) {
    const existing = await prisma.userRoleAssignment.findFirst({
      where: { userId: superAdminUser.id, roleId: superAdminRole.id },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({
        data: { userId: superAdminUser.id, roleId: superAdminRole.id },
      });
    }
  }
  console.log(`✓ Super admin user created: admin@ghmotive.com`);

  // ── System Settings ────────────────────────────────────────
  const settings = [
    { key: 'platform.name', value: 'GH Motive', type: 'string', category: 'platform', isPublic: true },
    { key: 'platform.currency', value: 'GHS', type: 'string', category: 'platform', isPublic: true },
    { key: 'platform.country', value: 'Ghana', type: 'string', category: 'platform', isPublic: true },
    { key: 'payment.mock_mode', value: 'true', type: 'boolean', category: 'payment', isPublic: false },
    { key: 'payment.default_provider', value: 'mock', type: 'string', category: 'payment', isPublic: false },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`✓ ${settings.length} system settings created`);

  console.log('\n✅ Database seeded successfully!');
  console.log('\n🔐 Default super admin credentials:');
  console.log('   Email:    admin@ghmotive.com');
  console.log('   Password: Admin@GHMotive2024!');
  console.log('\n⚠️  Change this password immediately in production!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
