'use client';

import { motion } from 'framer-motion';

const logos = ['NORTHLINE', 'SKYFIELD', 'SPARROW OPS', 'CIRCUITLAB', 'BLOOMSTACK'];

const testimonials = [
  {
    quote:
      'We replaced three disconnected tools and built one modular delivery system that every squad actually adopted.',
    author: 'Maya Chen',
    role: 'Head of Delivery, Northline Labs',
  },
  {
    quote:
      'Axxon gave us the flexibility of a custom internal platform with the speed of a modern SaaS rollout.',
    author: 'Andre Fulton',
    role: 'Operations Director, Skyfield Commerce',
  },
  {
    quote:
      'Our cross-functional boards finally feel coherent. Teams work differently, but governance now stays consistent.',
    author: 'Nora Patel',
    role: 'Program Lead, Sparrow Ops',
  },
];

export default function SocialProof() {
  return (
    <section className="landing-section">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.28 }}
          transition={{ duration: 0.55 }}
          className="mb-8"
        >
          <span className="landing-kicker">Social Proof</span>
          <h2 className="landing-title mt-3">Teams with complex operations choose Axxon to standardize execution.</h2>
        </motion.div>

        <div className="landing-logo-row">
          {logos.map((logo) => (
            <span key={logo} className="landing-logo-chip">
              {logo}
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {testimonials.map((item, index) => (
            <motion.article
              key={item.author}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className="landing-glass-card min-h-56"
            >
              <p className="text-sm leading-6 text-slate-700">&ldquo;{item.quote}&rdquo;</p>
              <div className="mt-5 border-t border-slate-200/80 pt-4">
                <p className="text-sm font-semibold text-slate-900">{item.author}</p>
                <p className="text-xs text-slate-500">{item.role}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
