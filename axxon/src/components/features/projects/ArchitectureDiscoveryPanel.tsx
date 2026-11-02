// Renders accessible, low-friction requirement questions for an architecture-agent run.
'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Surface from '@/components/ui/Surface';
import { submitProjectAgentDiscoveryAnswers } from '@/lib/api/projects/agentRuns';
import type { AgentClarificationAnswer, AgentRun } from '@/lib/types/agentTypes';

type ArchitectureDiscoveryPanelProps = {
  organizationId: string;
  projectId: string;
  run: AgentRun;
  onSubmitted: () => void;
};

// Presents one answer per question while keeping technical rationale available on demand.
export function ArchitectureDiscoveryPanel({ organizationId, projectId, run, onSubmitted }: ArchitectureDiscoveryPanelProps) {
  const [answers, setAnswers] = useState<Record<string, AgentClarificationAnswer>>({});
  const unanswered = useMemo(() => run.questions.filter((question) => !answers[question.questionKey]?.selectedOptionKey), [answers, run.questions]);
  const submitMutation = useMutation({
    mutationFn: () => submitProjectAgentDiscoveryAnswers(organizationId, projectId, run.id, run.questions.map((question) => answers[question.questionKey]).filter(Boolean)),
    onSuccess: onSubmitted,
  });

  return (
    <Surface variant="strong" className="rounded-[1.5rem] border-[var(--app-border-strong)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-kicker">Axxon needs a little context</p>
          <h2 className="mt-1 text-lg font-semibold">Answer the important questions first</h2>
          <p className="mt-2 text-sm leading-6 app-text-muted">These answers become project requirements. You can choose “I am not sure” and revise assumptions later.</p>
        </div>
        <span className="rounded-full border border-[var(--app-border)] px-2 py-1 text-xs app-text-muted">{run.questions.length - unanswered.length}/{run.questions.length}</span>
      </div>
      <div className="mt-5 space-y-5">
        {run.questions.map((question) => {
          const selected = answers[question.questionKey]?.selectedOptionKey;
          return <fieldset key={question.questionKey} className="border-t border-[var(--app-border)] pt-4">
            <legend className="text-sm font-medium">{question.prompt}</legend>
            <p className="mt-1 text-xs leading-5 app-text-muted">Why it matters: {question.whyThisMatters}</p>
            <div className="mt-3 grid gap-2">
              {question.options.map((option) => <button key={option.optionKey} type="button" aria-pressed={selected === option.optionKey} onClick={() => setAnswers((current) => ({ ...current, [question.questionKey]: { questionKey: question.questionKey, selectedOptionKey: option.optionKey } }))} className={`rounded-xl border p-3 text-left transition-colors ${selected === option.optionKey ? 'border-[var(--app-foreground)] bg-[var(--app-panel-soft)]' : 'border-[var(--app-border)] hover:border-[var(--app-border-strong)]'}`}>
                <span className="flex items-center justify-between gap-3 text-sm font-medium">{option.label}{option.isRecommended ? <span className="text-[10px] uppercase tracking-[0.14em] app-text-muted">Recommended</span> : null}</span>
                <span className="mt-1 block text-xs leading-5 app-text-muted">{option.description}</span>
              </button>)}
            </div>
          </fieldset>;
        })}
      </div>
      <Button className="mt-5 w-full" variant="primary" onClick={() => submitMutation.mutate()} disabled={unanswered.length > 0 || submitMutation.isPending}>
        {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {submitMutation.isPending ? 'Saving requirements' : 'Continue with these answers'}
      </Button>
      {submitMutation.isError ? <p role="alert" className="mt-3 text-xs app-error-text">{submitMutation.error.message}</p> : null}
    </Surface>
  );
}
