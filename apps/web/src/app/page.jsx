import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';
import FeaturesSection from '@/components/home/FeaturesSection';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import UserTypesSection from '@/components/home/UserTypesSection';
import CtaSection from '@/components/home/CtaSection';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navbar />
      <main id="main">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <UserTypesSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
