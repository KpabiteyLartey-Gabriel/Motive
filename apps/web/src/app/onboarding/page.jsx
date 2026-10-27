'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page used to run the National ID / Driver's licence setup wizard.
// Identity verification is not part of any flow anymore: Driver and Owner
// accounts are created in My Account (confirm code -> pay -> created) and
// open straight on their dashboards. Anyone landing here is sent to the
// right home so old bookmarks and links keep working.
export default function OnboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
      if (!localStorage.getItem('gh_motive_access_token')) router.replace('/login');
      else if (user.primaryRole === 'DRIVER') router.replace('/driver/dashboard');
      else if (user.primaryRole === 'OWNER') router.replace('/owner/dashboard');
      else router.replace('/portal/account');
    } catch {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-chalk">
      <p className="text-sm text-neutral-500">Taking you to your account…</p>
    </div>
  );
}
