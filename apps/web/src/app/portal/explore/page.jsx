import { redirect } from 'next/navigation';

// Explore merged into the Dashboard: /portal is the vehicle grid now.
// Keep this route as a redirect so old links and bookmarks still land.
export default function PortalExploreRedirect() {
  redirect('/portal');
}
