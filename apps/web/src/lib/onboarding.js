export const ROLE_DASHBOARDS = {
  PENDING: '/portal',
  DRIVER: '/driver/dashboard',
  OWNER: '/owner/dashboard',
  COMPANY_ADMIN: '/company/dashboard',
  COMPANY_MEMBER: '/company/dashboard',
  FLEET_MANAGER: '/fleet/dashboard',
  SERVICE_PROVIDER: '/portal',
  ADMIN: '/admin/dashboard',
  SUPER_ADMIN: '/admin/dashboard',
};

export function storeAuth({ accessToken, refreshToken, user }) {
  localStorage.setItem('gh_motive_access_token', accessToken);
  localStorage.setItem('gh_motive_refresh_token', refreshToken);
  localStorage.setItem('gh_motive_user', JSON.stringify(user));
}

export function dashboardForRole(role) {
  return ROLE_DASHBOARDS[role] || '/portal';
}

export function needsEmailVerification(user) {
  return !!user?.email && !user?.emailVerifiedAt;
}

// Current journey: create account -> verify email -> portal as a User.
// Driver/Owner accounts are created later in My Account (paid flow) and
// open straight on their dashboards — there is no National ID or licence
// setup step in any flow anymore.
export async function resolvePostAuthPath(user) {
  if (needsEmailVerification(user)) return '/verify-email';
  return dashboardForRole(user?.primaryRole);
}
