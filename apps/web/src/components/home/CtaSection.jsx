import Link from 'next/link';

export default function CtaSection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24 dark:bg-dark-bg">
      <div data-reveal className="mx-auto max-w-page rounded-[24px] bg-ink px-6 py-12 text-center shadow-lift sm:px-10 lg:py-16 dark:bg-dark-surface">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Ready to run your vehicle work with confidence?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100/75">
          Create your free account and set up your first contract, vehicle or payment in minutes.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/register" className="btn-primary px-6 text-[15px]">Create free account</Link>
          <Link href="/contact" className="btn-ghost-light px-6 text-[15px]">Talk to us</Link>
        </div>
        <p className="mt-5 text-[13px] text-brand-100/60">No credit card required · Free to get started · Cancel anytime</p>
      </div>
    </section>
  );
}
