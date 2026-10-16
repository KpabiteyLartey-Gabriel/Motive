import { Suspense } from 'react';
import RegisterForm from '@/components/auth/RegisterForm';
import AuthShell from '@/components/auth/AuthShell';
import Link from 'next/link';

export const metadata = { title: 'Create Account — +Motive' };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start. Set up in minutes — no card required."
      footer={
        <p className="mt-6 text-center text-sm text-steel dark:text-neutral-400">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Sign in</Link>
        </p>
      }
    >
      <Suspense fallback={<div className="skeleton h-64" aria-label="Loading form" />}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
