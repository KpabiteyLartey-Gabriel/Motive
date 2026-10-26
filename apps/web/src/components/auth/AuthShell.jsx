import BankShell from '@/components/auth/BankShell';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <BankShell title={title} subtitle={subtitle} footer={footer}>
      {children}
    </BankShell>
  );
}
