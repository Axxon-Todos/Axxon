// Runs planning-agent eval datasets from the command line for CI, release, and local workflows.
import { loadPlanningEvalCases, parsePlanningEvalTier, resolvePlanningEvalDatasetPath } from './dataset';
import { gradePlanningEvalTrace } from './graders';
import { gradePlanningTraceWithJudge } from './judge';
import { createPlanningEvalProvider, parsePlanningEvalProviderName } from './providers';
import {
  buildPlanningEvalReport,
  comparePlanningEvalBaseline,
  loadPlanningEvalBaseline,
  writePlanningEvalBaseline,
  writePlanningEvalReport,
} from './reporting';
import type { PlanningEvalCaseResult, PlanningEvalProviderName, PlanningEvalTier } from './types';
import { runPlanningEvalCase } from './runner';

type CliOptions = {
  tier: PlanningEvalTier;
  provider: PlanningEvalProviderName;
  judge: boolean;
  requireJudge: boolean;
  compareBaseline: boolean;
  updateBaseline: boolean;
};

function readArg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function parseOptions(): CliOptions {
  const tier = parsePlanningEvalTier(readArg('--tier', process.env.EVAL_PLANNING_TIER ?? 'smoke') ?? 'smoke');
  const provider = parsePlanningEvalProviderName(readArg('--provider', process.env.EVAL_PLANNING_PROVIDER ?? 'fixture') ?? 'fixture');
  const requireJudge = hasArg('--require-judge');

  return {
    tier,
    provider,
    judge: hasArg('--judge') || requireJudge,
    requireJudge,
    compareBaseline: hasArg('--compare-baseline'),
    updateBaseline: hasArg('--update-baseline'),
  };
}

function assertThresholds(report: ReturnType<typeof buildPlanningEvalReport>, options: CliOptions) {
  const errors: string[] = [];

  if (report.failedCases > 0) errors.push(`${report.failedCases} planning eval case(s) failed`);
  if (options.tier === 'smoke' && report.deterministicAverage < 100) errors.push('smoke eval deterministic average must be 100');
  if (options.tier !== 'smoke' && report.deterministicAverage < 85) errors.push('golden eval deterministic average must be at least 85');
  if (options.requireJudge && report.judgeAverage === null) errors.push('judge was required but did not run');
  if (options.requireJudge && report.judgeAverage !== null && report.judgeAverage < 4) errors.push('judge average must be at least 4.0');
  if (options.tier === 'judge-calibration' && report.calibrationAgreementRate !== null && report.calibrationAgreementRate < 80) {
    errors.push('judge calibration agreement must be at least 80%');
  }
  if (options.compareBaseline && report.baselineLossRate !== null && report.baselineLossRate > 10) errors.push('baseline loss rate must be at most 10%');

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
}

async function main() {
  const options = parseOptions();
  const cases = loadPlanningEvalCases(resolvePlanningEvalDatasetPath(options.tier));
  const results: PlanningEvalCaseResult[] = [];

  for (const evalCase of cases) {
    const provider = createPlanningEvalProvider(options.provider, evalCase);
    const trace = await runPlanningEvalCase(evalCase, provider);
    const grade = gradePlanningEvalTrace(evalCase, trace);
    const judge = options.judge
      ? await gradePlanningTraceWithJudge(evalCase, trace, options.requireJudge)
      : null;
    const minJudgeScore = evalCase.expected.minJudgeScore;
    const judgeIssues = judge && minJudgeScore !== undefined && judge.overallScore < minJudgeScore
      ? [{
          code: 'judge_score_too_low',
          severity: 'error' as const,
          message: `Judge score ${judge.overallScore} is below ${minJudgeScore}.`,
          evidence: [String(judge.overallScore)],
        }]
      : [];
    const calibrationIssues = judge && evalCase.human && (Math.abs(judge.overallScore - evalCase.human.overallScore) > 1 || ((evalCase.human.overallScore >= 4) !== judge.passed))
      ? [{
          code: 'judge_human_disagreement',
          severity: 'error' as const,
          message: `Judge score ${judge.overallScore} disagrees with human score ${evalCase.human.overallScore}.`,
          evidence: [`judge=${judge.overallScore}`, `human=${evalCase.human.overallScore}`],
        }]
      : [];

    results.push({
      case: evalCase,
      trace,
      grade: {
        ...grade,
        judge,
        issues: [...grade.issues, ...judgeIssues, ...calibrationIssues],
        passed: grade.passed && judgeIssues.length === 0 && calibrationIssues.length === 0 && (!judge || judge.passed),
      },
    });
  }

  const initialReport = buildPlanningEvalReport({
    tier: options.tier,
    provider: options.provider,
    results,
    baselineLossRate: null,
  });
  const baselineLossRate = options.compareBaseline
    ? comparePlanningEvalBaseline(initialReport, loadPlanningEvalBaseline())
    : null;
  const report = buildPlanningEvalReport({
    tier: options.tier,
    provider: options.provider,
    results,
    baselineLossRate,
  });
  const written = writePlanningEvalReport(report);

  if (options.updateBaseline) {
    const baselinePath = writePlanningEvalBaseline(report);
    process.stdout.write(`Updated planning eval baseline: ${baselinePath}\n`);
  }

  process.stdout.write(`Planning eval report: ${written.markdownPath}\n`);
  process.stdout.write(`${report.passedCases}/${report.totalCases} cases passed. Deterministic average: ${report.deterministicAverage}. Judge average: ${report.judgeAverage ?? 'not run'}. Calibration agreement: ${report.calibrationAgreementRate ?? 'not measured'}.\n`);
  assertThresholds(report, options);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
