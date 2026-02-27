'use client';

import { motion } from 'framer-motion';
import GoogleLoginButton from '@/components/ui/GoogleLoginButton';

const footerLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export default function FooterCta() {
  return (
    <footer className="relative overflow-hidden pb-14">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55 }}
          className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-[0_45px_120px_-70px_rgba(15,23,42,0.5)] backdrop-blur sm:p-10"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Ready to launch</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Build the customizable project management platform your team has been trying to piece together.
          </h2>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <GoogleLoginButton className="landing-google-button" label="Get Started with Google" />
            <a href="#home" className="landing-secondary-button">
              Back to top
            </a>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200/80 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Axxon. Modular planning and execution for modern teams.</p>
            <nav aria-label="Footer links" className="flex items-center gap-4">
              {footerLinks.map((item) => (
                <a key={item.label} href={item.href} className="transition-colors hover:text-slate-900">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
