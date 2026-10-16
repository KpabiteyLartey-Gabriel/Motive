import Link from 'next/link';
import { BrandMark } from './Navbar';

const footerSections = [
  {
    title: 'Platform',
    links: [
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'For Drivers', href: '/drivers' },
      { label: 'For Owners', href: '/owners' },
      { label: 'For Companies', href: '/companies' },
      { label: 'Fleet Managers, Maintenance & Legal', href: '/how-it-works#participants' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-white dark:border-dark-border dark:bg-dark-surface">
      <div className="mx-auto max-w-page px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <BrandMark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-steel dark:text-neutral-400">
              +Motive — vehicle operations, contracts, MoMo payments and fleet management for Ghana, connecting drivers, owners, companies, fleet managers, maintenance and legal professionals in one clear, auditable platform.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
              <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
              Built for Ghana&apos;s transport sector
            </p>
          </div>
          {footerSections.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h3 className="text-sm font-semibold text-ink dark:text-white">{section.title}</h3>
              <ul className="mt-4 space-y-1">
                {section.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="inline-flex min-h-[36px] items-center text-sm text-steel transition hover:text-brand-700 dark:text-neutral-400 dark:hover:text-brand-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {/* Bottom strip below the thin line — small, vivid vehicles band */}
      <div className="relative overflow-hidden border-t border-line bg-[#04231b] dark:border-dark-border">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src="/images/hero-vehicles.jpg"
            alt=""
            className="absolute right-0 top-0 h-full w-[min(430px,58%)] object-cover object-[50%_70%] saturate-[1.25] contrast-[1.08]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#03130c] via-[#03130c]/78 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#03130c]/55 via-transparent to-transparent" />
        </div>
        <div className="relative mx-auto flex min-h-[104px] max-w-page flex-col justify-center gap-2 px-4 py-6 text-[13px] text-brand-50/90 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} +Motive. All rights reserved.</p>
          <p className="max-w-xl leading-relaxed">
            Payment services are provided through licensed payment infrastructure. +Motive does not provide legal advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
