import LoginForm from '@/components/auth/LoginForm';
import AuthShell from '@/components/auth/AuthShell';
import Link from 'next/link';

export const metadata = { title: 'Sign In — +Motive' };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Enter your credentials to login."
      footer={
        <p className="mt-8 text-center text-sm text-steel dark:text-neutral-400">
          First time user?{' '}
          <Link href="/register" className="font-bold text-brand-700 hover:underline dark:text-brand-300">Click to register</Link>
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
