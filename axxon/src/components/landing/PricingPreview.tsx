'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$19',
    description: 'For focused teams building repeatable workflows.',
    features: ['Up to 10 members', 'Core boards and labels', 'Google auth and workspace setup'],
    cta: 'Start Starter',
  },
  {
    name: 'Scale',
    price: '$49',
    description: 'For multi-team operations needing deeper customization.',
    features: ['Unlimited projects', 'Advanced workflow modules', 'Priority support and onboarding'],
    cta: 'Choose Scale',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For organizations with advanced governance requirements.',
    features: ['Dedicated architecture guidance', 'Security and compliance alignment', 'Custom rollout support'],
    cta: 'Talk to Sales',
  },
];

export default function PricingPreview() {
  return (
    <section id="pricing" className="landing-section">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.28 }}
          transition={{ duration: 0.55 }}
          className="mb-10 max-w-2xl"
        >
          <span className="landing-kicker">Pricing Snapshot</span>
          <h2 className="landing-title mt-3">Pick the operating model that matches your stage of growth.</h2>
          <p className="landing-copy mt-4">
            Start quickly, scale modularly, and transition to enterprise-ready governance as your platform matures.
          </p>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className={[
                'rounded-3xl border p-6 shadow-[0_30px_75px_-48px_rgba(15,23,42,0.45)]',
                plan.featured
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200/80 bg-white/80 text-slate-900 backdrop-blur',
              ].join(' ')}
            >
              <p
                className={
                  plan.featured
                    ? 'text-xs font-semibold uppercase tracking-[0.16em] text-slate-200'
                    : 'text-xs font-semibold uppercase tracking-[0.16em] text-slate-500'
                }
              >
                {plan.name}
              </p>

              <div className="mt-3 flex items-end gap-1">
                <p className="text-4xl font-semibold tracking-tight">{plan.price}</p>
                {plan.price !== 'Custom' ? (
                  <span className={plan.featured ? 'text-slate-300' : 'text-slate-500'}>/month</span>
                ) : null}
              </div>

              <p className={plan.featured ? 'mt-3 text-sm text-slate-300' : 'mt-3 text-sm text-slate-600'}>
                {plan.description}
              </p>

              <ul className="mt-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#home"
                className={[
                  'mt-7 inline-flex rounded-full px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5',
                  plan.featured
                    ? 'bg-white text-slate-900'
                    : 'border border-slate-300 bg-white text-slate-800',
                ].join(' ')}
              >
                {plan.cta}
              </a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
