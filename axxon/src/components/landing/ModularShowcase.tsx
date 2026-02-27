'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

const modules = [
  {
    name: 'Board Templates',
    detail: 'Launch new initiatives with proven planning structures in minutes.',
    state: 'Live',
  },
  {
    name: 'Workflow Automations',
    detail: 'Automate recurring transitions and status updates between categories.',
    state: 'Configurable',
  },
  {
    name: 'Label Systems',
    detail: 'Standardize priorities, effort, and domains across departments.',
    state: 'Reusable',
  },
  {
    name: 'Collaboration Rules',
    detail: 'Set contributor visibility and team-level ownership boundaries per board.',
    state: 'Policy-ready',
  },
];

export default function ModularShowcase() {
  return (
    <section id="modularity" className="landing-section pt-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 lg:grid-cols-[1.1fr_1fr] lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-slate-200/80 bg-white/70 p-8 shadow-[0_35px_95px_-55px_rgba(15,23,42,0.45)] backdrop-blur"
        >
          <span className="landing-kicker">Modular Control</span>
          <h2 className="landing-title mt-3 text-balance">
            Design your operating system once, then adapt each module without rebuilding from scratch.
          </h2>
          <p className="landing-copy mt-4">
            Axxon lets you compose reusable units for planning, execution, collaboration, and visibility. Teams can
            move fast while still honoring governance, naming conventions, and delivery standards.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Deployment Speed</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">From days to hours</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Configuration Drift</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">Dramatically reduced</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="landing-glass-card p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Module Registry</p>
          <div className="mt-5 space-y-3">
            {modules.map((module, index) => (
              <motion.div
                key={module.name}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="rounded-2xl border border-slate-200/80 bg-white/85 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{module.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{module.detail}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {module.state}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
