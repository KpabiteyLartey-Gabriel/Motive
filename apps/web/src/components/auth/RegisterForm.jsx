'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';

const roles = [
  { value: 'DRIVER', label: 'Driver', description: 'I drive or want to drive a vehicle' },
  { value: 'OWNER', label: 'Vehicle Owner', description: 'I own vehicles and want to manage them' },
  { value: 'COMPANY_ADMIN', label: 'Transport Company', description: 'I manage a transport or fleet company' },
];

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role')?.toUpperCase() || 'DRIVER';

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
    role: roles.find((r) => r.value === defaultRole) ? defaultRole : 'DRIVER',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    setError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.firstName.trim()) errors.firstName = 'First name is required';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required';
    if (!form.email && !form.phone) errors.email = 'Add an email or phone number so we can reach you';
    if (form.password.length < 8) errors.password = 'Use at least 8 characters';
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match — check and try again';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setLoading(true);
    setError('');
    const { confirmPassword, ...submitData } = form;
    if (!submitData.email) delete submitData.email;
    if (!submitData.phone) delete submitData.phone;
    try {
      const response = await authApi.register(submitData);
      const { accessToken, refreshToken, user } = response.data.data;
      localStorage.setItem('gh_motive_access_token', accessToken);
      localStorage.setItem('gh_motive_refresh_token', refreshToken);
      localStorage.setItem('gh_motive_user', JSON.stringify(user));
      const roleRedirects = { DRIVER: '/driver/dashboard', OWNER: '/owner/dashboard', COMPANY_ADMIN: '/company/dashboard' };
      router.push(roleRedirects[user.primaryRole] || '/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  };

  const err = (name) => fieldErrors[name] ? <p className="field-error" role="alert">{fieldErrors[name]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

      <fieldset>
        <legend className="label">I am joining as…</legend>
        <div className="grid gap-2" role="radiogroup" aria-label="Account type">
          {roles.map((role) => {
            const selected = form.role === role.value;
            return (
              <label key={role.value} className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${selected ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-500/10 dark:bg-brand-950' : 'border-line bg-white hover:border-brand-300 dark:border-dark-border dark:bg-dark-card'}`}>
                <input type="radio" name="role" value={role.value} checked={selected} onChange={handleChange} className="h-5 w-5 shrink-0 accent-emerald-600" />
                <span>
                  <span className="block text-sm font-semibold text-ink dark:text-white">{role.label}</span>
                  <span className="block text-[13px] text-steel dark:text-neutral-400">{role.description}</span>
                </span>
                {selected && <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" aria-hidden="true">✓</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="label">First name</label>
          <input id="firstName" name="firstName" type="text" autoComplete="given-name" required className={fieldErrors.firstName ? 'input input-error' : 'input'} placeholder="Kofi" value={form.firstName} onChange={handleChange} aria-invalid={!!fieldErrors.firstName} />
          {err('firstName')}
        </div>
        <div>
          <label htmlFor="lastName" className="label">Last name</label>
          <input id="lastName" name="lastName" type="text" autoComplete="family-name" required className={fieldErrors.lastName ? 'input input-error' : 'input'} placeholder="Mensah" value={form.lastName} onChange={handleChange} aria-invalid={!!fieldErrors.lastName} />
          {err('lastName')}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="label">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" className={fieldErrors.email ? 'input input-error' : 'input'} placeholder="kofi@example.com" value={form.email} onChange={handleChange} aria-invalid={!!fieldErrors.email} />
        {err('email') || <p className="field-hint">Email or phone is required — both is best for account recovery.</p>}
      </div>

      <div>
        <label htmlFor="phone" className="label">Phone number <span className="font-normal text-steel">(MoMo number helps)</span></label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" className="input" placeholder="+233 20 123 4567" value={form.phone} onChange={handleChange} />
      </div>

      <div>
        <label htmlFor="password" className="label">Password</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required className={`${fieldErrors.password ? 'input input-error' : 'input'} pr-20`} placeholder="At least 8 characters" value={form.password} onChange={handleChange} aria-invalid={!!fieldErrors.password} />
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-1.5 top-1/2 flex min-h-[36px] -translate-y-1/2 items-center rounded-lg px-3 text-[13px] font-semibold text-steel hover:bg-mist hover:text-ink dark:text-neutral-300 dark:hover:bg-dark-elevated" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
        </div>
        {err('password') || <p className="field-hint">8+ characters. Mix letters and numbers for a stronger password.</p>}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required className={fieldErrors.confirmPassword ? 'input input-error' : 'input'} placeholder="Repeat your password" value={form.confirmPassword} onChange={handleChange} aria-invalid={!!fieldErrors.confirmPassword} />
        {err('confirmPassword')}
      </div>

      <p className="text-[13px] leading-relaxed text-steel dark:text-neutral-400">
        By creating an account you agree to GH Motive&apos;s{' '}
        <Link href="/terms" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Terms of Service</Link> and{' '}
        <Link href="/privacy" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Privacy Policy</Link>.
      </p>

      <button type="submit" disabled={loading} className="btn-primary w-full text-[15px]" aria-busy={loading}>
        {loading ? <><span className="spinner" aria-hidden="true" /> Creating your account…</> : 'Create free account'}
      </button>
    </form>
  );
}
