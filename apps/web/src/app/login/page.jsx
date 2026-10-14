import LoginForm from '@/components/auth/LoginForm';
import AuthShell from '@/components/auth/AuthShell';
import Link from 'next/link';

export const metadata = { title: 'Sign In — GH Motive' };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your contracts, payments and vehicles."
      footer={
        <p className="mt-6 text-center text-sm text-steel dark:text-neutral-400">
          New to GH Motive?{' '}
          <Link href="/register" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Create a free account</Link>
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
