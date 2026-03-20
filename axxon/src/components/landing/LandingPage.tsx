'use client';

import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  BookText,
  FolderGit2,
  GitBranch,
  Layers3,
  Network,
  ShieldCheck,
} from 'lucide-react';
import GoogleLoginButton from '@/components/ui/GoogleLoginButton';

const pillars = [
  {
    title: 'Repository Coordination',
    description:
      'Keep work anchored to the actual engineering surface instead of scattering repo context across chats and disconnected task tools.',
    icon: FolderGit2,
  },
  {
    title: 'Org-Level Work Control',
    description:
      'Use organizations and boards as the boundary where ownership, execution, and delivery visibility stay aligned.',
    icon: Layers3,
  },
  {
    title: 'Agent Execution Layer',
    description:
      'Structure tasks so human-owned, AI-assisted, and AI-executed work all live inside the same operating model.',
    icon: Bot,
  },
  {
    title: 'Context Continuity',
    description:
      'Preserve task history, execution traces, documentation, and decision flow instead of losing critical context between runs.',
    icon: BookText,
  },
];

const workflowSteps = [
  'Create an organization around the engineering team or product boundary.',
  'Organize boards as the execution layer for repo-scoped work.',
  'Capture tasks with enough structure for humans and agents to operate consistently.',
  'Run and review work with context, ownership, and continuity kept in one system.',
];

export default function LandingPage() {
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-root">
        <section className="relative isolate overflow-hidden px-6 pb-20 pt-8 sm:pt-10 lg:px-10 lg:pb-28">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.22),transparent_36%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.2),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.92))]" />

          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
            <header className="flex items-center justify-between gap-6">
              <a href="#top" className="text-xl font-semibold tracking-tight text-slate-900">
                Axxon
              </a>

              <nav
                className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex"
                aria-label="Landing navigation"
              >
                <a href="#capabilities" className="transition-colors hover:text-slate-950">
                  Capabilities
                </a>
                <a href="#workflow" className="transition-colors hover:text-slate-950">
                  Workflow
                </a>
                <a href="#control-plane" className="transition-colors hover:text-slate-950">
                  Product Story
                </a>
              </nav>

              <a href="#cta" className="glass-button hidden md:inline-flex">
                Get Access
              </a>
            </header>

            <div className="grid gap-10 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 24 }}
                animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: [0.2, 0.75, 0.2, 1] }}
                className="max-w-3xl"
              >
                <span className="landing-pill">
                  Agent-work orchestration for software teams
                </span>

                <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  Bring repo context, structured work, and AI execution under one operating layer.
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
                  Axxon gives engineering organizations a controlled layer above code hosting, task coordination, and agent workflows. Teams use organizations, boards, and tasks to turn AI coding work into something structured, visible, and durable.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <GoogleLoginButton className="landing-google-button" label="Sign in with Google" />
                  <a href="#control-plane" className="landing-secondary-button">
                    Explore the control plane <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </motion.div>

              <motion.div
                id="control-plane"
                initial={reducedMotion ? false : { opacity: 0, y: 30 }}
                animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="glass-panel-strong rounded-[2rem] p-6 shadow-[0_32px_90px_-44px_rgba(15,23,42,0.56)]"
              >
                <p className="app-kicker">Control Plane</p>
                <div className="mt-5 space-y-4">
                  <StoryNode icon={<Network className="h-5 w-5" />} title="Organizations">
                    Own members, boards, shared context, settings, and the execution boundary.
                  </StoryNode>
                  <StoryNode icon={<GitBranch className="h-5 w-5" />} title="Repo Context">
                    Map engineering work to the repositories and code surfaces that matter.
                  </StoryNode>
                  <StoryNode icon={<Layers3 className="h-5 w-5" />} title="Boards and Tasks">
                    Use structured work layers to control execution, ownership, and visibility.
                  </StoryNode>
                  <StoryNode icon={<Bot className="h-5 w-5" />} title="Agent Work">
                    Run assisted or autonomous work with the surrounding context preserved.
                  </StoryNode>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="landing-section">
          <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
            <div className="mb-10 max-w-3xl">
              <span className="landing-kicker">Capabilities</span>
              <h2 className="landing-title mt-3 text-balance">
                The product is built for engineering coordination, not generic productivity theater.
              </h2>
              <p className="landing-copy mt-4">
                Every surface is being reoriented around technical work structure, execution clarity, and durable context.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {pillars.map(({ title, description, icon: Icon }, index) => (
                <motion.article
                  key={title}
                  initial={reducedMotion ? false : { opacity: 0, y: 20 }}
                  whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.45, delay: reducedMotion ? 0 : index * 0.04 }}
                  className="landing-glass-card min-h-44"
                >
                  <div className="mb-4 inline-flex rounded-xl border border-slate-200/80 bg-white p-3 text-slate-800 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-section">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
            <div>
              <span className="landing-kicker">Workflow Shape</span>
              <h2 className="landing-title mt-3 text-balance">
                The operating model is organization first, execution second.
              </h2>
              <p className="landing-copy mt-4">
                This keeps access, ownership, board structure, and future repo connections inside one coherent boundary.
              </p>
            </div>

            <div className="space-y-3">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step}
                  initial={reducedMotion ? false : { opacity: 0, x: 18 }}
                  whileInView={reducedMotion ? {} : { opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.22 }}
                  transition={{ duration: 0.4, delay: reducedMotion ? 0 : index * 0.05 }}
                  className="glass-panel flex items-start gap-4 rounded-[1.5rem] p-5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] text-sm font-semibold text-[var(--app-accent)]">
                    {index + 1}
                  </span>
                  <p className="leading-7 text-slate-700">{step}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className="landing-section pb-20">
          <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
            <div className="glass-panel-strong rounded-[2rem] p-8 sm:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <span className="landing-kicker">Access</span>
                  <h2 className="landing-title mt-3 text-balance">
                    Replace scattered AI coding workflows with a structured execution system.
                  </h2>
                  <p className="landing-copy mt-4">
                    Start with organizations and boards now. Repo onboarding and deeper agent flows can plug into the same boundary next.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <GoogleLoginButton className="landing-google-button" label="Start with Google" />
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

function StoryNode({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="glass-panel rounded-[1.5rem] p-4">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] text-[var(--app-accent)]">
          {icon}
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{children}</p>
        </div>
      </div>
    </article>
  );
}
