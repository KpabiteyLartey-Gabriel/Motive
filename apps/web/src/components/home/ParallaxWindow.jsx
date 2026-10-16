export default function ParallaxWindow({ title, text }) {
  return (
    <section className="relative flex min-h-[300px] items-end sm:min-h-[360px]" aria-label={title}>
      <div className="mx-auto w-full max-w-page px-4 pb-10 sm:px-6 lg:px-8">
        <div data-reveal className="max-w-md rounded-[20px] border border-white/25 bg-[#03130c]/72 p-6 shadow-lift backdrop-blur-[2px]">
          <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-50/85">{text}</p>
        </div>
      </div>
    </section>
  );
}
