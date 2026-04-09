// Renders the public landing page for Axxon's AI-native agile platform positioning and premium visual identity.
'use client';

import dynamic from 'next/dynamic';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  FolderGit2,
  Layers3,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

import GoogleLoginButton from '@/components/ui/GoogleLoginButton';

const HeroScene = dynamic(() => import('@/components/landing/HeroScene'), {
  ssr: false,
  loading: () => <div className="hero-scene-fallback absolute inset-0" aria-hidden />,
});

const pillars = [
  {
    title: 'Agent Sprint Planning',
    description:
      'Turn structured work into an execution queue that agents and humans can both understand without losing delivery intent.',
    icon: BrainCircuit,
  },
  {
    title: 'Repo-True Context',
    description:
      'Keep boards, repositories, access, and shared execution history aligned so AI work stays grounded in the real engineering surface.',
    icon: FolderGit2,
  },
  {
    title: 'Org-First Governance',
    description:
      'Use organizations as the hard boundary for members, permissions, boards, and integrations instead of bolting control on later.',
    icon: ShieldCheck,
  },
  {
    title: 'Continuous Review Loops',
    description:
      'Move from planning to dispatch to verification with one operating model instead of scattering context across disconnected tools.',
    icon: Workflow,
  },
];

const workflowSteps = [
  {
    label: 'Plan',
    title: 'Shape a board around the work the agent should execute.',
    detail: 'Use org-scoped boards, categories, and task definitions to create a reliable operating surface.',
  },
  {
    label: 'Dispatch',
    title: 'Launch agent work with repo context, ownership, and intent intact.',
    detail: 'Execution stays tied to the same board model instead of becoming a detached chat thread.',
  },
  {
    label: 'Verify',
    title: 'Review throughput, status, and completion from the same control plane.',
    detail: 'Analytics, settings, and membership stay native to the product instead of living in a second system.',
  },
];

const operatingStats = [
  { value: 'Org-first', label: 'boundary for members, repos, and boards' },
  { value: 'Agent-native', label: 'execution model built for software delivery' },
  { value: 'Durable', label: 'context survives past a single run or prompt' },
];

const platformLayers = [
  'Organizations anchor ownership, access, and integrations.',
  'Boards define the execution surface for product or engineering initiatives.',
  'Tasks and categories provide a structured backlog agents can operate against.',
  'Analytics and settings close the loop without leaving the workspace.',
];

export default function LandingPage() {
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-root">
        <section className="landing-grid-overlay relative isolate overflow-hidden px-6 pb-24 pt-8 sm:pt-10 lg:px-10 lg:pb-32">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-12">
            <header className="flex items-center justify-between gap-6">
              <a href="#top" className="landing-brand text-xl font-semibold tracking-tight text-[var(--app-foreground-strong)]">
                Axxon
              </a>

              <nav
                className="hidden items-center gap-6 text-sm font-medium text-[var(--app-muted-strong)] md:flex"
                aria-label="Landing navigation"
              >
                <a href="#platform" className="transition-colors hover:text-[var(--app-foreground-strong)]">
                  Platform
                </a>
                <a href="#workflow" className="transition-colors hover:text-[var(--app-foreground-strong)]">
                  Workflow
                </a>
                <a href="#product" className="transition-colors hover:text-[var(--app-foreground-strong)]">
                  Product
                </a>
              </nav>

              <a href="#cta" className="landing-secondary-button hidden md:inline-flex">
                Get access
              </a>
            </header>

            <div className="grid gap-10 xl:grid-cols-[0.98fr_1.02fr] xl:items-center">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 24 }}
                animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.2, 0.75, 0.2, 1] }}
                className="max-w-3xl"
              >
                <span className="landing-pill">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI-native agile platform for agent teams
                </span>

                <h1 className="landing-hero-title mt-6 text-balance">
                  Run AI agents through a real delivery system, not a pile of prompts.
                </h1>

                <p className="landing-copy mt-6 max-w-2xl text-lg">
                  Axxon gives software teams a premium control layer for planning, dispatching, and reviewing AI execution.
                  Organizations, boards, repository context, and analytics all live in one product model that agents can actually work inside.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <GoogleLoginButton label="Start with Google" />
                  <a href="#product" className="landing-secondary-button">
                    Explore the product <ArrowRight className="h-4 w-4" />
                  </a>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {operatingStats.map((stat, index) => (
                    <motion.article
                      key={stat.value}
                      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                      animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: reducedMotion ? 0 : 0.1 + index * 0.05 }}
                      className="landing-glass-card"
                    >
                      <p className="text-2xl font-semibold tracking-tight text-[var(--app-foreground-strong)]">
                        {stat.value}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--app-muted-strong)]">{stat.label}</p>
                    </motion.article>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 32 }}
                animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.72, delay: 0.12 }}
                className="landing-glass-card relative overflow-hidden rounded-[2rem] p-5 sm:p-6"
              >
                <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-accent)_20%,transparent),transparent)]" />
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="app-kicker">Operating Model</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-foreground-strong)]">
                        Organizations frame the work. Boards dispatch it. Reviews close the loop.
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--app-muted-strong)]">
                        The scene maps Axxon&apos;s actual system shape: org governance, board planning, repo truth,
                        agent execution, and review all connected inside one governed workflow.
                      </p>
                    </div>
                    <span className="app-badge">
                      <Bot className="h-3.5 w-3.5" />
                      Agent control plane
                    </span>
                  </div>

                  <div className="relative h-[360px] overflow-hidden rounded-[1.6rem] border border-[var(--app-border)] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--app-accent)_14%,transparent),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.88),rgba(17,24,39,0.96))]">
                    <HeroScene />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="glass-panel rounded-[1.3rem] p-4">
                      <p className="app-kicker">Control loop</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['Plan', 'Dispatch', 'Review', 'Ship'].map((item) => (
                          <span key={item} className="app-badge">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="glass-panel rounded-[1.3rem] p-4">
                      <p className="app-kicker">System shape</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--app-muted-strong)]">
                        Organizations own boards, GitHub installs, members, and execution history so AI work stays governed by the same boundary.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="platform" className="landing-section">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
            <div className="mb-10 max-w-3xl">
              <span className="landing-kicker">Platform model</span>
              <h2 className="landing-title mt-4 text-balance">
                Axxon is built to make AI execution feel operational, governed, and reviewable.
              </h2>
              <p className="landing-copy mt-4">
                The platform does not pretend AI work is the same as generic project management. It is shaped around execution boundaries, repo truth, and delivery visibility.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {pillars.map(({ title, description, icon: Icon }, index) => (
                <motion.article
                  key={title}
                  initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: reducedMotion ? 0 : index * 0.04 }}
                  className="landing-glass-card min-h-52"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_90%,transparent)] text-[var(--app-accent)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-[var(--app-foreground-strong)]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--app-muted-strong)]">{description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-section">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-10">
            <div>
              <span className="landing-kicker">Workflow</span>
              <h2 className="landing-title mt-4 text-balance">
                Plan, dispatch, and verify with one pattern across the entire platform.
              </h2>
              <p className="landing-copy mt-4">
                The same design language extends from the landing page into the product shell so every organization, board, and review surface feels like part of one system.
              </p>
            </div>

            <div className="space-y-3">
              {workflowSteps.map((step, index) => (
                <motion.article
                  key={step.label}
                  initial={reducedMotion ? false : { opacity: 0, x: 18 }}
                  whileInView={reducedMotion ? {} : { opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.24 }}
                  transition={{ duration: 0.42, delay: reducedMotion ? 0 : index * 0.05 }}
                  className="landing-glass-card flex gap-4 rounded-[1.6rem] p-5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--app-accent)_84%,white_16%),color-mix(in_srgb,var(--app-highlight)_38%,transparent))] text-[var(--app-accent-foreground)]">
                    {step.label.slice(0, 1)}
                  </div>
                  <div>
                    <p className="app-kicker">{step.label}</p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--app-foreground-strong)]">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--app-muted-strong)]">{step.detail}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="landing-section">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
            <div className="mb-10 max-w-3xl">
              <span className="landing-kicker">Product language</span>
              <h2 className="landing-title mt-4 text-balance">
                The product shell now mirrors the platform story: premium surfaces, sharp hierarchy, and deliberate simplicity.
              </h2>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
              <div className="landing-glass-card rounded-[2rem] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="app-kicker">Core surfaces</p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--app-foreground-strong)]">
                      A single UI pattern across shell, boards, analytics, and settings
                    </h3>
                  </div>
                  <span className="app-badge">
                    <Layers3 className="h-3.5 w-3.5" />
                    Reusable components
                  </span>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="glass-panel-strong rounded-[1.5rem] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="app-kicker">Board hero</p>
                        <p className="mt-2 text-xl font-semibold text-[var(--app-foreground-strong)]">Agent Sprint Alpha</p>
                      </div>
                      <span className="h-3.5 w-3.5 rounded-full bg-[var(--app-accent)]" />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="app-badge">12 categories</span>
                      <span className="app-badge">48 todos</span>
                      <span className="app-badge">GitHub linked</span>
                    </div>
                    <div className="mt-5 grid gap-3">
                      {platformLayers.map((item) => (
                        <div key={item} className="glass-panel rounded-[1.1rem] px-4 py-3 text-sm text-[var(--app-muted-strong)]">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="glass-panel rounded-[1.4rem] p-5">
                      <p className="app-kicker">Analytics</p>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="rounded-[1rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_92%,transparent)] px-3 py-4">
                          <p className="text-xs app-text-muted">Completion</p>
                          <p className="mt-2 text-2xl font-semibold">68%</p>
                        </div>
                        <div className="rounded-[1rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_92%,transparent)] px-3 py-4">
                          <p className="text-xs app-text-muted">Active</p>
                          <p className="mt-2 text-2xl font-semibold">19</p>
                        </div>
                        <div className="rounded-[1rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_92%,transparent)] px-3 py-4">
                          <p className="text-xs app-text-muted">Members</p>
                          <p className="mt-2 text-2xl font-semibold">9</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel rounded-[1.4rem] p-5">
                      <p className="app-kicker">Settings</p>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between rounded-[1rem] border border-[var(--app-border)] px-4 py-3">
                          <span className="text-sm text-[var(--app-muted-strong)]">Board access</span>
                          <span className="app-badge">Owners + members</span>
                        </div>
                        <div className="flex items-center justify-between rounded-[1rem] border border-[var(--app-border)] px-4 py-3">
                          <span className="text-sm text-[var(--app-muted-strong)]">Linked repositories</span>
                          <span className="app-badge">4 active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="landing-glass-card rounded-[1.8rem] p-6">
                  <p className="app-kicker">Why it reads differently</p>
                  <h3 className="mt-3 text-2xl font-semibold text-[var(--app-foreground-strong)]">
                    Fewer gimmicks. Stronger hierarchy. Cleaner execution.
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[var(--app-muted-strong)]">
                    The new UI system uses one color story, one spacing rhythm, and one surface language across the entire platform instead of mixing unrelated visual patterns.
                  </p>
                </div>

                <div className="landing-glass-card rounded-[1.8rem] p-6">
                  <p className="app-kicker">Default theme</p>
                  <p className="mt-3 text-lg font-semibold text-[var(--app-foreground-strong)]">Slate, indigo, and cyan</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--app-muted-strong)]">
                    The brand now anchors the product in graphite neutrals, indigo primary actions, and a restrained cyan accent. Light mode stays available without breaking hierarchy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="landing-section pb-24">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
            <div className="landing-glass-card rounded-[2rem] p-8 sm:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <span className="landing-kicker">Get access</span>
                  <h2 className="landing-title mt-4 text-balance">
                    Replace scattered AI workflows with one operating system for delivery.
                  </h2>
                  <p className="landing-copy mt-4">
                    Start inside an organization, connect repository context, and run AI agent work from the same workspace your team uses to review it.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <GoogleLoginButton label="Enter Axxon" />
                  <span className="app-badge">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Org-scoped access model
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
