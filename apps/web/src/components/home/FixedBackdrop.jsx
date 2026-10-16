export default function FixedBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#04231b]" aria-hidden="true">
      <img
        src="/images/hero-vehicles.jpg"
        alt=""
        className="absolute right-0 top-0 h-full w-auto max-w-none object-cover saturate-[1.18] contrast-[1.06] max-lg:left-0 max-lg:w-full"
      />
      {/* Soft darkening on the left for hero text; vehicles on the right stay vivid */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#03130c]/95 via-[#03130c]/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#03130c]/55 via-transparent to-[#03130c]/20" />
    </div>
  );
}
