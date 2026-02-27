'use client';

import { motion } from 'framer-motion';

const faqItems = [
  {
    question: 'How is Axxon different from standard kanban tools?',
    answer:
      'Axxon is modular by design. Instead of forcing fixed workflows, it lets teams compose boards, categories, labels, and collaboration patterns that fit their real operating model.',
  },
  {
    question: 'Can we start with one team and scale later?',
    answer:
      'Yes. You can begin with a single workspace, validate your structure, and then replicate winning modules across teams without rebuilding from zero.',
  },
  {
    question: 'Does Axxon support secure access controls?',
    answer:
      'Current access starts with authenticated users and board membership flows. The architecture is set up for deeper role-based permissions as your governance needs evolve.',
  },
  {
    question: 'Is onboarding complex for non-technical teams?',
    answer:
      'No. Teams can start with predefined workspace structures and customize progressively. The interface is intentionally built for operational clarity over configuration complexity.',
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className="landing-section pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.28 }}
          transition={{ duration: 0.55 }}
          className="mb-8 max-w-3xl"
        >
          <span className="landing-kicker">FAQ</span>
          <h2 className="landing-title mt-3">Answers for teams evaluating a long-term project operating platform.</h2>
        </motion.div>

        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <motion.details
              key={item.question}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              className="group rounded-2xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.45)] backdrop-blur"
            >
              <summary className="cursor-pointer list-none text-base font-semibold text-slate-900 marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  {item.question}
                  <span className="text-xl leading-none text-slate-500 transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
            </motion.details>
          ))}
        </div>
      </div>
    </section>
  );
}
