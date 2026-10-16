import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import AuthShell from '@/components/auth/AuthShell';
import Link from 'next/link';

export const metadata = { title: 'Forgot Password — GH Motive' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email or phone number on your account. We will send you a reset link by email and SMS."
      footer={
        <p className="mt-6 text-center text-sm text-steel dark:text-neutral-400">
          Remembered it?{' '}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Back to sign in</Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
