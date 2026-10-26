export const PORTAL_NAV = [
  { href: '/portal', icon: 'dashboard', label: 'Dashboard', exact: true },
  { href: '/portal/chat', icon: 'messages', label: 'Chat' },
  { href: '/portal/explore', icon: 'explore', label: 'Explore' },
  { href: '/portal/account', icon: 'profile', label: 'My Account' },
  { href: '/portal/notifications', icon: 'notifications', label: 'Notifications' },
  { href: '/portal/settings', icon: 'settings', label: 'Settings' },
];

export function roleNamesOf(user) {
  const names = new Set();
  if (user?.primaryRole) names.add(user.primaryRole);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  for (const r of roles) {
    if (typeof r === 'string') names.add(r);
    else if (r?.role?.name) names.add(r.role.name);
    else if (r?.name) names.add(r.name);
  }
  return names;
}

// Company users manage several accounts, so their tab is "Accounts";
// everyone else sees "My Account".
export function getPortalNav(user) {
  const roles = roleNamesOf(user);
  const isCompanyUser = roles.has('COMPANY_ADMIN') || roles.has('COMPANY_MEMBER') || roles.has('FLEET_MANAGER');
  if (!isCompanyUser) return PORTAL_NAV;
  return PORTAL_NAV.map((item) =>
    item.href === '/portal/account' ? { ...item, label: 'Accounts' } : item,
  );
}
