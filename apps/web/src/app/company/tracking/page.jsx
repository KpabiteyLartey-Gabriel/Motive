'use client';

import FleetTracking from '@/components/tracking/FleetTracking';
import { COMPANY_NAV, COMPANY_ROLES } from '@/lib/companyNav';

export default function CompanyTrackingPage() {
  return <FleetTracking navItems={COMPANY_NAV} requiredRoles={COMPANY_ROLES} />;
}
