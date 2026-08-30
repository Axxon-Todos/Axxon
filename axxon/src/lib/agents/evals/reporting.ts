// Builds, writes, and compares planning-agent eval reports and baselines.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  PlanningEvalBaseline,
  PlanningEvalBaselineCase,
  PlanningEvalCaseResult,
  PlanningEvalProviderName,
  PlanningEvalReport,
  PlanningEvalTier,
} from './types';

const REPORT_ROOT = path.resolve(process.cwd(), '.eval-runs/planning');
const BASELINE_PATH = path.resolve(process.cwd(), 'evals/planning/baselines/current.json');

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function reportRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function summarizeIssues(result: PlanningEvalCaseResult) {
  return result.grade.issues
    .map((issue) => `    - ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`)
    .join('\n');
}

function calculateCalibrationAgreement(results: PlanningEvalCaseResult[]) {
  const judgedHumanCases = results.filter((result) => result.case.human && result.grade.judge);
  if (judgedHumanCases.length === 0) return null;
  const agreements = judgedHumanCases.filter((result) => {
    const humanScore = result.case.human!.overallScore;
    const judgeScore = result.grade.judge!.overallScore;
    const classificationAgrees = (humanScore >= 4) === result.grade.judge!.passed;
    return Math.abs(humanScore - judgeScore) <= 1 && classificationAgrees;
  });

  return Math.round((agreements.length / judgedHumanCases.length) * 10000) / 100;
}

// Creates a report object from completed case results.
export function buildPlanningEvalReport({
  tier,
  provider,
  results,
  baselineLossRate,
}: {
  tier: PlanningEvalTier;
  provider: PlanningEvalProviderName;
  results: PlanningEvalCaseResult[];
  baselineLossRate?: number | null;
}): PlanningEvalReport {
  const judgeScores = results.flatMap((result) => result.grade.judge ? [result.grade.judge.overallScore] : []);

  return {
    tier,
    provider,
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    passedCases: results.filter((result) => result.grade.passed).length,
    failedCases: results.filter((result) => !result.grade.passed).length,
    deterministicAverage: average(results.map((result) => result.grade.deterministicScore)),
    judgeAverage: judgeScores.length > 0 ? average(judgeScores) : null,
    calibrationAgreementRate: calculateCalibrationAgreement(results),
    baselineLossRate: baselineLossRate ?? null,
    results,
  };
}

// Writes JSON and Markdown summaries for one eval report.
export function writePlanningEvalReport(report: PlanningEvalReport) {
  const outputDir = path.join(REPORT_ROOT, reportRunId());
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'report.json');
  const markdownPath = path.join(outputDir, 'report.md');
  const markdown = [
    `# Planning Eval Report`,
    ``,
    `- Tier: ${report.tier}`,
    `- Provider: ${report.provider}`,
    `- Generated: ${report.generatedAt}`,
    `- Cases: ${report.passedCases}/${report.totalCases} passed`,
    `- Deterministic average: ${report.deterministicAverage}`,
    `- Judge average: ${report.judgeAverage ?? 'not run'}`,
    `- Calibration agreement: ${report.calibrationAgreementRate ?? 'not measured'}`,
    `- Baseline loss rate: ${report.baselineLossRate ?? 'not compared'}`,
    ``,
    ...report.results.map((result) => [
      `## ${result.case.id}`,
      ``,
      `- Passed: ${result.grade.passed}`,
      `- Final state: ${result.trace.finalState}`,
      `- Deterministic score: ${result.grade.deterministicScore}`,
      `- Judge score: ${result.grade.judge?.overallScore ?? 'not run'}`,
      result.grade.issues.length > 0 ? `- Issues:\n${summarizeIssues(result)}` : '- Issues: none',
      ``,
    ].join('\n')),
  ].join('\n');

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdown);
  return { outputDir, jsonPath, markdownPath };
}

function hashResult(result: PlanningEvalCaseResult) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      caseId: result.case.id,
      score: result.grade.deterministicScore,
      passed: result.grade.passed,
      quality: result.trace.quality,
      artifact: result.trace.planArtifact,
    }))
    .digest('hex');
}

// Converts a report into a compact baseline snapshot.
export function buildPlanningEvalBaseline(report: PlanningEvalReport): PlanningEvalBaseline {
  return {
    generatedAt: report.generatedAt,
    provider: report.provider,
    cases: report.results.map((result) => ({
      caseId: result.case.id,
      passed: result.grade.passed,
      deterministicScore: result.grade.deterministicScore,
      judgeOverallScore: result.grade.judge?.overallScore,
      artifactHash: hashResult(result),
    })),
  };
}

// Writes the current report as the committed comparison baseline.
export function writePlanningEvalBaseline(report: PlanningEvalReport) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(buildPlanningEvalBaseline(report), null, 2)}\n`);
  return BASELINE_PATH;
}

// Loads the committed baseline if present.
export function loadPlanningEvalBaseline(): PlanningEvalBaseline | null {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as PlanningEvalBaseline;
}

// Computes the share of cases that regressed compared with the committed baseline.
export function comparePlanningEvalBaseline(report: PlanningEvalReport, baseline: PlanningEvalBaseline | null) {
  if (!baseline) return null;
  const baselineByCaseId = new Map(baseline.cases.map((entry) => [entry.caseId, entry]));
  let compared = 0;
  let losses = 0;

  for (const result of report.results) {
    const baselineCase = baselineByCaseId.get(result.case.id);
    if (!baselineCase) continue;
    compared += 1;

    const lostPassStatus = baselineCase.passed && !result.grade.passed;
    const lostDeterministicScore = result.grade.deterministicScore < baselineCase.deterministicScore - 5;
    const lostJudgeScore =
      baselineCase.judgeOverallScore !== undefined &&
      result.grade.judge?.overallScore !== undefined &&
      result.grade.judge.overallScore < baselineCase.judgeOverallScore - 0.25;

    if (lostPassStatus || lostDeterministicScore || lostJudgeScore) losses += 1;
  }

  return compared === 0 ? null : Math.round((losses / compared) * 10000) / 100;
}
