'use client';

import { MotionConfig } from 'framer-motion';
import HeroSection from '@/components/landing/HeroSection';
import FeatureGrid from '@/components/landing/FeatureGrid';
import ModularShowcase from '@/components/landing/ModularShowcase';
import SocialProof from '@/components/landing/SocialProof';
import PricingPreview from '@/components/landing/PricingPreview';
import FaqSection from '@/components/landing/FaqSection';
import FooterCta from '@/components/landing/FooterCta';

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-root">
        <HeroSection />
        <FeatureGrid />
        <ModularShowcase />
        <SocialProof />
        <PricingPreview />
        <FaqSection />
        <FooterCta />
      </div>
    </MotionConfig>
  );
}
