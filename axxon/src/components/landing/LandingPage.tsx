// Presents Axxon's org-first agent workflow with a monochrome, two-dimensional visual system.
'use client';

import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowRight, Check, GitBranch, Layers3, MoveUpRight, Sparkles } from 'lucide-react';
import GoogleLoginButton from '@/components/ui/GoogleLoginButton';

const workflow = [
  { number: '01', title: 'Plan together', detail: 'Shape work in an organization, then give each board a clear purpose.' },
  { number: '02', title: 'Ground the agent', detail: 'Connect repository context and keep access inside your team boundary.' },
  { number: '03', title: 'Review the work', detail: 'Follow runs, decisions, tasks, and delivery from the same workspace.' },
];

const capabilities = [
  { icon: Layers3, title: 'One place for the work', detail: 'Organizations, boards, sprints, and tasks share a clear structure.' },
  { icon: GitBranch, title: 'Connected to the code', detail: 'Repositories and agent context stay close to the work they support.' },
  { icon: Sparkles, title: 'Built for agent teams', detail: 'Plan, clarify, and review agent work with your team in the loop.' },
];

// Draws a flat workflow diagram that stays readable without animation.
function WorkflowGraphic() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="landing-diagram" aria-label="Organization connects boards, repositories, agent work, and review">
      <div className="landing-diagram-header"><span>AXXON / WORKSPACE</span><span className="landing-diagram-live"><i /> LIVE WORKFLOW</span></div>
      <div className="landing-diagram-body">
        <motion.div className="landing-diagram-node landing-diagram-org" initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={reducedMotion ? {} : { opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <span>01 / ORGANIZATION</span><strong>Your team&apos;s space</strong><small>People, permissions, shared context</small>
        </motion.div>
        <div className="landing-diagram-connector" aria-hidden="true"><i /></div>
        <div className="landing-diagram-middle">
          <motion.div className="landing-diagram-node" initial={reducedMotion ? false : { opacity: 0, x: -12 }} animate={reducedMotion ? {} : { opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.38 }}>
            <span>02 / BOARD</span><strong>Plan the work</strong><small>Tasks, sprints, ownership</small>
          </motion.div>
          <motion.div className="landing-diagram-node" initial={reducedMotion ? false : { opacity: 0, x: 12 }} animate={reducedMotion ? {} : { opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.46 }}>
            <span>03 / REPOSITORY</span><strong>Keep context close</strong><small>Connected code and access</small>
          </motion.div>
        </div>
        <div className="landing-diagram-connector" aria-hidden="true"><i /></div>
        <motion.div className="landing-diagram-node landing-diagram-result" initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={reducedMotion ? {} : { opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }}>
          <span>04 / AGENT WORK</span><strong>Make progress visible</strong><small className="landing-diagram-check"><Check size={14} /> Plan <ArrowRight size={13} /> Run <ArrowRight size={13} /> Review</small>
        </motion.div>
      </div>
      <div className="landing-diagram-footer"><span>ONE CONNECTED SYSTEM</span><span>001 — 004</span></div>
    </div>
  );
}

// Renders the landing page with restrained motion and a single grayscale palette.
export default function LandingPage() {
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <main className="landing-root" id="top">
        <header className="landing-nav">
          <a className="landing-wordmark" href="#top" aria-label="Axxon home">Axxon<span>.</span></a>
          <nav aria-label="Landing navigation" className="landing-nav-links"><a href="#platform">Platform</a><a href="#workflow">Workflow</a><a href="#product">Product</a></nav>
          <a className="landing-nav-action" href="#start">Get started <MoveUpRight size={15} /></a>
        </header>

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <motion.p className="landing-eyebrow" initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={reducedMotion ? {} : { opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>THE WORKSPACE FOR AGENT TEAMS <span>— 01</span></motion.p>
            <motion.h1 id="landing-title" initial={reducedMotion ? false : { opacity: 0, y: 20 }} animate={reducedMotion ? {} : { opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08 }}>Give agent work<br />a clear place<br /><em>to happen.</em></motion.h1>
            <motion.p className="landing-hero-description" initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={reducedMotion ? {} : { opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.18 }}>Plan, run, and review software work in one connected space for your team and its agents.</motion.p>
            <motion.div className="landing-hero-actions" initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={reducedMotion ? {} : { opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.26 }}><GoogleLoginButton label="Start with Google" /><a className="landing-text-link" href="#platform">Explore the platform <ArrowRight size={17} /></a></motion.div>
          </div>
          <div className="landing-hero-visual"><WorkflowGraphic /></div>
          <a className="landing-scroll-cue" href="#platform">SCROLL TO EXPLORE <ArrowDown size={14} /></a>
        </section>

        <section className="landing-editorial-section" id="platform" aria-labelledby="platform-title">
          <div className="landing-section-intro"><span className="landing-section-number">01 / THE PLATFORM</span><h2 id="platform-title">Everything connected.<br />Nothing in the way.</h2></div>
          <div className="landing-feature-list">
            {capabilities.map(({ icon: Icon, title, detail }, index) => (
              <motion.article key={title} className="landing-feature-row" initial={reducedMotion ? false : { opacity: 0, y: 16 }} whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.45, delay: index * 0.06 }}>
                <span className="landing-feature-icon"><Icon size={20} strokeWidth={1.6} /></span><h3>{title}</h3><p>{detail}</p><ArrowRight className="landing-feature-arrow" size={18} />
              </motion.article>
            ))}
          </div>
        </section>

        <section className="landing-workflow-section" id="workflow" aria-labelledby="workflow-title">
          <div className="landing-workflow-heading"><span className="landing-section-number">02 / HOW IT WORKS</span><h2 id="workflow-title">From intention<br />to delivery.</h2><p>One path for the work, from the first idea to the final review.</p></div>
          <div className="landing-steps">
            {workflow.map((step, index) => (
              <motion.article key={step.number} className="landing-step" initial={reducedMotion ? false : { opacity: 0, y: 18 }} whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.45, delay: index * 0.07 }}><span>{step.number}</span><h3>{step.title}</h3><p>{step.detail}</p></motion.article>
            ))}
          </div>
        </section>

        <section className="landing-product-section" id="product" aria-labelledby="product-title">
          <div><span className="landing-section-number">03 / THE WORKSPACE</span><h2 id="product-title">Clarity at every level.</h2><p>Move between organizations, boards, agent planning, and analytics without losing the thread.</p></div>
          <div className="landing-product-preview" aria-label="Illustration of an Axxon board">
            <div className="landing-preview-sidebar"><span className="landing-preview-logo">A.</span><span className="landing-preview-nav-current">Overview</span><span>Boards</span><span>Agents</span><span>Analytics</span></div>
            <div className="landing-preview-main"><div className="landing-preview-top"><span>ACME / PRODUCT</span><span>⌘ K</span></div><h3>Product workspace</h3><p>Keep the team aligned with the work in motion.</p><div className="landing-preview-stats"><div><span>OPEN TASKS</span><strong>24</strong></div><div><span>IN PROGRESS</span><strong>08</strong></div><div><span>COMPLETED</span><strong>36</strong></div></div><div className="landing-preview-table"><div><span>WORK ITEM</span><span>STATUS</span></div><div><span>Refine onboarding flow</span><span>In progress</span></div><div><span>Review agent plan</span><span>Ready</span></div><div><span>Connect repository</span><span>Complete</span></div></div></div>
          </div>
        </section>

        <section className="landing-cta" id="start" aria-labelledby="start-title"><span className="landing-section-number">04 / GET STARTED</span><h2 id="start-title">Make room for<br /><em>better work.</em></h2><p>Bring your team and its agents into one clear workspace.</p><GoogleLoginButton label="Enter Axxon" /></section>
        <footer className="landing-footer"><a className="landing-wordmark" href="#top">Axxon<span>.</span></a><span>BUILT FOR TEAMS THAT BUILD SOFTWARE</span><a href="#top">BACK TO TOP ↑</a></footer>
      </main>
    </MotionConfig>
  );
}
