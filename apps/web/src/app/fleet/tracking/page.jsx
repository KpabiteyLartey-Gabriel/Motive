'use client';

import FleetTracking from '@/components/tracking/FleetTracking';
import { FLEET_NAV, FLEET_ROLES } from '@/lib/fleetNav';

export default function FleetManagerTrackingPage() {
  return <FleetTracking navItems={FLEET_NAV} requiredRoles={FLEET_ROLES} />;
}
