// Loads and validates JSONL planning-agent eval datasets from the repository.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { planningEvalCaseSchema, planningEvalTiers, type PlanningEvalCase, type PlanningEvalTier } from './types';

const DATASET_ROOT = path.resolve(process.cwd(), 'evals/planning');

// Returns the committed dataset path for a named eval tier.
export function resolvePlanningEvalDatasetPath(tier: PlanningEvalTier) {
  return path.join(DATASET_ROOT, 'cases', `${tier}.jsonl`);
}

// Parses one JSONL row into a validated eval case with defaults applied.
export function parsePlanningEvalCaseLine(line: string, sourceLabel: string): PlanningEvalCase {
  let decoded: unknown;
  try {
    decoded = JSON.parse(line);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`${sourceLabel}: ${message}`);
  }

  const parsed = planningEvalCaseSchema.safeParse(decoded);
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues.map((issue) => {
    const issuePath = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${issuePath}: ${issue.message}`;
  }).join('; ');
  throw new Error(`${sourceLabel}: ${issues}`);
}

// Reads a JSONL eval dataset and returns all non-comment cases.
export function loadPlanningEvalCases(datasetPath: string): PlanningEvalCase[] {
  const content = fs.readFileSync(datasetPath, 'utf8');
  const cases = content
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line.length > 0 && !line.startsWith('#'))
    .map(({ line, index }) => parsePlanningEvalCaseLine(line, `${datasetPath}:${index + 1}`));
  const ids = new Set<string>();

  for (const evalCase of cases) {
    if (ids.has(evalCase.id)) throw new Error(`Duplicate planning eval case id "${evalCase.id}"`);
    ids.add(evalCase.id);
  }

  return cases;
}

// Validates a CLI tier string before resolving it to a dataset path.
export function parsePlanningEvalTier(value: string): PlanningEvalTier {
  const parsed = z.enum(planningEvalTiers).safeParse(value);
  if (!parsed.success) {
    throw new Error(`Unknown planning eval tier "${value}". Use one of: ${planningEvalTiers.join(', ')}`);
  }

  return parsed.data;
}
