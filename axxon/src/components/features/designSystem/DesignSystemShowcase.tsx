// Shows live examples of the shared monochrome tokens, components, and motion patterns.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Plus } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PageHero from '@/components/ui/PageHero';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Surface from '@/components/ui/Surface';
import { useTheme } from '@/context/ThemeProvider';

// Renders a developer-facing component gallery using the same primitives as product screens.
export default function DesignSystemShowcase() {
  const [view, setView] = useState<'overview' | 'activity'>('overview');
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="app-shell-bg min-h-screen px-6 py-10 sm:px-10">
      <div className="app-page max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-semibold tracking-tight">Axxon.</Link>
          <Button variant="secondary" onClick={toggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</Button>
        </div>
        <PageHero kicker="Developer reference" title="Axxon design system" description="Reusable tokens, surfaces, controls, and motion for every product view." actions={<Button variant="primary"><Plus size={16} /> Primary action</Button>} badges={<><Badge>Default</Badge><Badge variant="success"><Check size={14} /> Complete</Badge><Badge variant="danger">Needs review</Badge></>} />
        <div className="grid gap-6 md:grid-cols-2">
          <Surface className="rounded-xl p-6">
            <p className="app-kicker">Actions</p>
            <h2 className="mt-3 text-2xl font-semibold">Buttons and controls</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary">Continue <ArrowRight size={16} /></Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Destructive</Button>
            </div>
            <div className="mt-6"><SegmentedControl ariaLabel="Reference view" value={view} onChange={setView} options={[{ value: 'overview', label: 'Overview' }, { value: 'activity', label: 'Activity' }]} /></div>
          </Surface>
          <Surface variant="strong" className="rounded-xl p-6">
            <p className="app-kicker">Inputs</p>
            <h2 className="mt-3 text-2xl font-semibold">Form fields</h2>
            <label className="mt-6 block text-sm font-medium" htmlFor="reference-name">Workspace name</label>
            <input id="reference-name" className="app-input mt-2" placeholder="Platform Engineering" />
            <label className="mt-5 block text-sm font-medium" htmlFor="reference-note">Description</label>
            <textarea id="reference-note" className="app-input mt-2 min-h-24" placeholder="A short description" />
          </Surface>
        </div>
        <Surface variant="interactive" className="rounded-xl p-6">
          <p className="app-kicker">Palette</p>
          <h2 className="mt-3 text-2xl font-semibold">Semantic surfaces</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              ['Background', 'var(--app-bg)'],
              ['Panel', 'var(--app-panel)'],
              ['Soft panel', 'var(--app-panel-soft)'],
              ['Accent', 'var(--app-accent)'],
            ].map(([label, value]) => (
              <div key={label} className="overflow-hidden rounded-lg border border-[var(--app-border)]">
                <div className="h-20" style={{ background: value }} />
                <div className="border-t border-[var(--app-border)] p-3 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </main>
  );
}
