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
              Vehicle operations, contracts, MoMo payments and fleet management for Ghana — in one clear, auditable platform.
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
                  <li key={link.href}>
                    <Link href={link.href} className="inline-flex min-h-[36px] items-center text-sm text-steel transition hover:text-brand-700 dark:text-neutral-400 dark:hover:text-brand-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-[13px] text-steel sm:flex-row sm:items-center sm:justify-between dark:border-dark-border dark:text-neutral-500">
          <p>© {new Date().getFullYear()} GH Motive. All rights reserved.</p>
          <p className="max-w-xl leading-relaxed">
            Payment services are provided through licensed payment infrastructure. GH Motive does not provide legal advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
