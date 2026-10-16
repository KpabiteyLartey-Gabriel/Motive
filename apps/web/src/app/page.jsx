import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FixedBackdrop from '@/components/home/FixedBackdrop';
import HeroSection from '@/components/home/HeroSection';
import Ticker from '@/components/home/Ticker';
import FeaturesSection from '@/components/home/FeaturesSection';
import ParallaxWindow from '@/components/home/ParallaxWindow';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import UserTypesSection from '@/components/home/UserTypesSection';
import CtaSection from '@/components/home/CtaSection';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <FixedBackdrop />
      <Navbar />
      <main id="main" className="relative z-10">
        <HeroSection />
        <Ticker />
        <FeaturesSection />
        <ParallaxWindow
          title="Every vehicle. Every payment. One record."
          text="The truck, the car, the bike and the tricycle — whatever earns on the road, +Motive keeps its contracts, money and location in one place."
        />
        <HowItWorksSection />
        <UserTypesSection />
        <ParallaxWindow
          title="Built for everyone who keeps Ghana moving."
          text="Drivers, owners, companies, fleet managers, maintenance providers and legal professionals — six participants, one connected platform."
        />
        <CtaSection />
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
