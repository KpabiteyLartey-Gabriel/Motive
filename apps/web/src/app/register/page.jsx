import { Suspense } from 'react';
import RegisterForm from '@/components/auth/RegisterForm';
import OnboardingShell from '@/components/auth/OnboardingShell';
import Link from 'next/link';

export const metadata = { title: 'Create Account — +Motive' };

const STEPS = [
  { key: 'account', label: 'Create account', status: 'current' },
  { key: 'verify', label: 'Verify email', status: 'todo' },
  { key: 'portal', label: 'Portal', status: 'todo' },
];

export default function RegisterPage() {
  return (
    <OnboardingShell
      title="Create your account"
      steps={STEPS}
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
    </OnboardingShell>
  );
}
