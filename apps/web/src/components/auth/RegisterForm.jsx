'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { resolvePostAuthPath, storeAuth } from '@/lib/onboarding';
import GoogleButton from '@/components/auth/GoogleButton';

// Step 1 of onboarding: create the account (or continue with Google).
// Driver vs Owner is chosen in step 2 at /onboarding, so no role is
// asked for here.
export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
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

  const finish = async (data) => {
    storeAuth(data);
    router.push(await resolvePostAuthPath(data.user));
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
      await finish(response.data.data);
    } catch (err) {
      if (!err.response && (submitData.email || submitData.phone)) {
        try {
          const loginRes = await authApi.login({ identifier: submitData.email || submitData.phone, password: submitData.password });
          await finish(loginRes.data.data);
          return;
        } catch {}
      }
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  };

  const err = (name) => fieldErrors[name] ? <p className="field-error" role="alert">{fieldErrors[name]}</p> : null;

  return (
    <div className="space-y-5">
      <GoogleButton label="Continue with Google" />
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line dark:bg-dark-border" />
        <span className="text-xs font-medium text-steel dark:text-neutral-400">or create an account with email</span>
        <span className="h-px flex-1 bg-line dark:bg-dark-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

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
          {err('email')}
        </div>

        <div>
          <label htmlFor="phone" className="label">Phone number</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" className="input" placeholder="+233 20 123 4567" value={form.phone} onChange={handleChange} />
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required className={`${fieldErrors.password ? 'input input-error' : 'input'} pr-20`} placeholder="At least 8 characters" value={form.password} onChange={handleChange} aria-invalid={!!fieldErrors.password} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-1.5 top-1/2 flex min-h-[36px] -translate-y-1/2 items-center rounded-lg px-3 text-[13px] font-semibold text-steel hover:bg-mist hover:text-ink dark:text-neutral-300 dark:hover:bg-dark-elevated" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          {err('password')}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">Confirm password</label>
          <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required className={fieldErrors.confirmPassword ? 'input input-error' : 'input'} placeholder="Repeat your password" value={form.confirmPassword} onChange={handleChange} aria-invalid={!!fieldErrors.confirmPassword} />
          {err('confirmPassword')}
        </div>

        <p className="text-[13px] leading-relaxed text-steel dark:text-neutral-400">
          By continuing you agree to our{' '}
          <Link href="/terms" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Terms</Link> and{' '}
          <Link href="/privacy" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Privacy Policy</Link>.
        </p>

        <button type="submit" disabled={loading} className="btn-primary w-full text-[15px]" aria-busy={loading}>
          {loading ? <><span className="spinner" aria-hidden="true" /> Creating your account…</> : <>Continue <span aria-hidden="true">→</span></>}
        </button>
      </form>
    </div>
  );
}
