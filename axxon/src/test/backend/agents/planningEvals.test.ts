// Verifies the planning-agent eval harness, deterministic graders, judge adapter, and baseline comparison.
import { afterEach, describe, expect, it } from 'vitest';
import { loadPlanningEvalCases, parsePlanningEvalCaseLine, resolvePlanningEvalDatasetPath } from '@/lib/agents/evals/dataset';
import { gradePlanningEvalTrace } from '@/lib/agents/evals/graders';
import { gradePlanningTraceWithJudge } from '@/lib/agents/evals/judge';
import { createPlanningEvalProvider } from '@/lib/agents/evals/providers';
import { buildPlanningEvalReport, comparePlanningEvalBaseline } from '@/lib/agents/evals/reporting';
import { runPlanningEvalCase } from '@/lib/agents/evals/runner';
import type { PlanningEvalCaseResult } from '@/lib/agents/evals/types';

describe('planning eval harness', () => {
  afterEach(() => {
    delete process.env.EVAL_JUDGE_MOCK;
  });

  it('loads committed smoke cases with defaults applied', () => {
    const cases = loadPlanningEvalCases(resolvePlanningEvalDatasetPath('smoke'));

    expect(cases.length).toBeGreaterThanOrEqual(3);
    expect(cases[0]?.expected.mustPassQuality).toBe(false);
    expect(cases[2]?.expected.minQualityScore).toBe(90);
  });

  it('rejects malformed JSONL rows with a source-aware error', () => {
    expect(() => parsePlanningEvalCaseLine('{"id": ""}', 'inline:1')).toThrow(/inline:1/);
  });

  it('runs fixture traces through the eval-only planning lifecycle', async () => {
    const evalCase = loadPlanningEvalCases(resolvePlanningEvalDatasetPath('smoke'))[0]!;
    const trace = await runPlanningEvalCase(evalCase, createPlanningEvalProvider('fixture', evalCase));
    const grade = gradePlanningEvalTrace(evalCase, trace);

    expect(trace.finalState).toBe('awaiting_message');
    expect(trace.finalDecisionAction).toBe('respond');
    expect(grade.passed).toBe(true);
  });

  it('grades generated org-first plans and catches forbidden terms', async () => {
    const evalCase = loadPlanningEvalCases(resolvePlanningEvalDatasetPath('smoke'))
      .find((candidate) => candidate.id === 'smoke-org-scoped-plan-completes')!;
    const trace = await runPlanningEvalCase(evalCase, createPlanningEvalProvider('fixture', evalCase));
    const grade = gradePlanningEvalTrace(evalCase, trace);
    const stricterGrade = gradePlanningEvalTrace({
      ...evalCase,
      expected: {
        ...evalCase.expected,
        forbiddenTerms: ['org-scoped'],
      },
    }, trace);

    expect(trace.finalState).toBe('awaiting_plan_review');
    expect(trace.quality?.passed).toBe(true);
    expect(grade.passed).toBe(true);
    expect(stricterGrade.passed).toBe(false);
    expect(stricterGrade.issues.map((issue) => issue.code)).toContain('forbidden_term_present');
  });

  it('uses the deterministic mock judge for local judge verification', async () => {
    process.env.EVAL_JUDGE_MOCK = '1';
    const evalCase = loadPlanningEvalCases(resolvePlanningEvalDatasetPath('smoke'))
      .find((candidate) => candidate.id === 'smoke-org-scoped-plan-completes')!;
    const trace = await runPlanningEvalCase(evalCase, createPlanningEvalProvider('fixture', evalCase));
    const judge = await gradePlanningTraceWithJudge(evalCase, trace, true);

    expect(judge).toMatchObject({
      passed: true,
      overallScore: 5,
    });
  });

  it('computes baseline loss rate from deterministic regressions', async () => {
    const evalCase = loadPlanningEvalCases(resolvePlanningEvalDatasetPath('smoke'))[0]!;
    const trace = await runPlanningEvalCase(evalCase, createPlanningEvalProvider('fixture', evalCase));
    const grade = gradePlanningEvalTrace(evalCase, trace);
    const result: PlanningEvalCaseResult = { case: evalCase, trace, grade };
    const report = buildPlanningEvalReport({
      tier: 'smoke',
      provider: 'fixture',
      results: [result],
      baselineLossRate: null,
    });

    expect(comparePlanningEvalBaseline(report, {
      generatedAt: '2026-08-29T00:00:00.000Z',
      provider: 'fixture',
      cases: [{ caseId: evalCase.id, passed: true, deterministicScore: 100 }],
    })).toBe(0);

    expect(comparePlanningEvalBaseline(report, {
      generatedAt: '2026-08-29T00:00:00.000Z',
      provider: 'fixture',
      cases: [{ caseId: evalCase.id, passed: true, deterministicScore: 110 }],
    })).toBe(100);
  });
});
