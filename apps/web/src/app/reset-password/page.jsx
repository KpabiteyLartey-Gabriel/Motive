import { Suspense } from 'react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import AuthShell from '@/components/auth/AuthShell';
import Link from 'next/link';

export const metadata = { title: 'Reset Password — GH Motive' };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong new password for your +Motive account. All other signed-in sessions will be signed out."
      footer={
        <p className="mt-6 text-center text-sm text-steel dark:text-neutral-400">
          Link expired?{' '}
          <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Request a new reset link</Link>
        </p>
      }
    >
      <Suspense fallback={<p className="text-sm text-steel dark:text-neutral-400">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
