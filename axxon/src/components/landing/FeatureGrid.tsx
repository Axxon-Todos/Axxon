'use client';

import { motion } from 'framer-motion';
import {
  Blocks,
  ChartSpline,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from 'lucide-react';

const featureItems = [
  {
    title: 'Composable boards',
    description:
      'Build workspaces with categories, labels, and role-ready structures that can be cloned across teams.',
    icon: Blocks,
  },
  {
    title: 'Workflow precision',
    description:
      'Create board states that match real operational flow, not generic templates that break under complexity.',
    icon: Workflow,
  },
  {
    title: 'Real-time collaboration',
    description:
      'Keep everyone aligned through live updates, collaborative ownership, and context preserved at task level.',
    icon: UsersRound,
  },
  {
    title: 'Actionable visibility',
    description:
      'Track bottlenecks and delivery momentum with analytics-ready structures designed for continuous improvement.',
    icon: ChartSpline,
  },
  {
    title: 'Secure by design',
    description:
      'JWT-backed auth flow and board-level access controls keep sensitive project work isolated and controlled.',
    icon: ShieldCheck,
  },
  {
    title: 'Scale without friction',
    description:
      'Ship repeatable operating models for every new team while preserving local flexibility where it matters.',
    icon: Sparkles,
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="landing-section">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.28 }}
          transition={{ duration: 0.55 }}
          className="mb-10 max-w-3xl"
        >
          <span className="landing-kicker">Feature Story</span>
          <h2 className="landing-title mt-3 text-balance">
            Every core capability is designed to be mixed, extended, and deployed with intent.
          </h2>
          <p className="landing-copy mt-4">
            Axxon is built for teams that outgrow one-size-fits-all tools. You get deep customization without
            losing speed, consistency, or collaboration quality.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureItems.map(({ title, description, icon: Icon }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.22 }}
              transition={{ duration: 0.5, delay: index * 0.04 }}
              whileHover={{ y: -5 }}
              className="landing-glass-card min-h-44"
            >
              <div className="mb-4 inline-flex rounded-xl border border-slate-200/80 bg-white p-3 text-slate-800 shadow-sm">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
