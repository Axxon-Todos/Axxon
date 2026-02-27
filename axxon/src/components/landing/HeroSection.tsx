'use client';

import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, PlayCircle } from 'lucide-react';
import GoogleLoginButton from '@/components/ui/GoogleLoginButton';

const HeroScene = dynamic(() => import('@/components/landing/HeroScene'), {
  ssr: false,
  loading: () => <div className="hero-scene-fallback absolute inset-0" aria-hidden />,
});

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Modularity', href: '#modularity' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const metrics = [
  { value: '48%', label: 'faster board setup with reusable modules' },
  { value: '4x', label: 'more visibility across teams and workstreams' },
  { value: '99.9%', label: 'uptime-ready architecture for scaling teams' },
];

export default function HeroSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section id="home" className="landing-grid-overlay relative isolate overflow-hidden pb-16 pt-6 sm:pt-8 lg:pb-24">
      <div className="absolute inset-0 -z-20">
        <HeroScene />
      </div>

      <div className="absolute inset-0 -z-10 bg-[radial-gradient(100%_100%_at_15%_8%,rgba(83,177,255,0.26)_0%,rgba(83,177,255,0)_65%),radial-gradient(90%_90%_at_86%_20%,rgba(255,171,105,0.22)_0%,rgba(255,171,105,0)_60%),linear-gradient(180deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.9)_80%)]" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 lg:px-10">
        <header className="flex items-center justify-between gap-6">
          <a href="#home" className="landing-brand text-xl font-semibold tracking-tight text-slate-900">
            Axxon
          </a>

          <nav
            className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex"
            aria-label="Landing navigation"
          >
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="transition-colors hover:text-slate-950">
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href="#pricing"
            className="hidden rounded-full border border-slate-300/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 backdrop-blur md:inline-flex"
          >
            View plans
          </a>
        </header>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 28 }}
          animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.2, 0.75, 0.2, 1] }}
          className="max-w-3xl space-y-8"
        >
          <span className="landing-pill">Modular project OS for ambitious teams</span>

          <h1 className="landing-hero-title text-balance">
            Shape project workflows your way, without sacrificing speed or team alignment.
          </h1>

          <p className="landing-copy max-w-2xl text-lg text-slate-700">
            Axxon turns boards, categories, labels, and collaboration flows into composable building blocks.
            Design each workspace for how your team actually works, then scale the same system across every project.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <GoogleLoginButton className="landing-google-button" label="Start with Google" />
            <a href="#features" className="landing-secondary-button">
              Explore features <PlayCircle className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <p className="text-sm text-slate-600">
            Trusted by product, design, operations, and engineering teams building complex initiatives.
          </p>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.15, ease: [0.2, 0.75, 0.2, 1] }}
          className="grid gap-4 sm:grid-cols-3"
        >
          {metrics.map((metric) => (
            <article key={metric.value} className="landing-glass-card">
              <div className="flex items-center justify-between">
                <p className="text-3xl font-semibold tracking-tight text-slate-900">{metric.value}</p>
                <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden />
              </div>
              <p className="mt-2 text-sm text-slate-600">{metric.label}</p>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
