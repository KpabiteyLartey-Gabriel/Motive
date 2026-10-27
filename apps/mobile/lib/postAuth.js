// Main Onboarding routing: register -> verify email -> User portal.
// A fresh account is just a User (primaryRole PENDING) with no Driver,
// Owner or other role until they add one later from the portal.
export function needsEmailVerification(user) {
  return !!user?.email && !user?.emailVerifiedAt;
}

const ROLE_ROUTES = {
  DRIVER: '/(driver)/dashboard',
  OWNER: '/(owner)/dashboard',
  // Company/admin roles have no dedicated mobile home yet; keep their
  // previous landing rather than stranding them in the User portal.
  COMPANY_ADMIN: '/(driver)/dashboard',
  FLEET_MANAGER: '/(driver)/dashboard',
  ADMIN: '/(driver)/dashboard',
  SUPER_ADMIN: '/(driver)/dashboard',
};

export function postAuthRoute(user) {
  if (needsEmailVerification(user)) return '/(auth)/verify-email';
  return ROLE_ROUTES[user?.primaryRole] || '/(user)/home';
}
