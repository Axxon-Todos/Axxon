// Converts exported production planning traces into gitignored eval-candidate JSONL rows.
import fs from 'node:fs';
import path from 'node:path';

type ExportedTrace = {
  id?: string | number;
  prompt?: string;
  messages?: Array<{ role?: string; content?: string }>;
  planArtifact?: unknown;
  quality?: { passed?: boolean; score?: number; issues?: Array<{ code?: string }> };
};

function redact(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[redacted-number]')
    .replace(/ghp_[A-Za-z0-9_]+/g, '[redacted-token]')
    .trim();
}

function readExportedTraces(inputPath: string) {
  return fs.readFileSync(inputPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ExportedTrace);
}

function toCandidate(trace: ExportedTrace, index: number) {
  const prompt = redact(trace.prompt ?? trace.messages?.find((message) => message.role === 'user')?.content ?? '');
  if (!prompt) return null;

  return {
    id: `prod-candidate-${trace.id ?? index + 1}`,
    category: 'production-candidate',
    description: 'Sanitized production planning trace candidate. Review before moving into golden.jsonl.',
    prompt,
    expected: {
      requirePlanArtifact: true,
      mustPassQuality: true,
      minQualityScore: Math.max(70, trace.quality?.score ?? 70),
      architectureRules: ['org_first', 'agent_backend_only', 'no_github_writes_before_approval', 'no_legacy_board_routes'],
    },
  };
}

function main() {
  const inputPath = process.env.EVAL_TRACE_EXPORT_PATH?.trim();
  if (!inputPath) throw new Error('EVAL_TRACE_EXPORT_PATH is required for planning trace mining');

  const outputDir = path.resolve(process.cwd(), 'evals/planning/inbox');
  const outputPath = path.join(outputDir, `mined-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
  const candidates = readExportedTraces(inputPath)
    .map(toCandidate)
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${candidates.map((candidate) => JSON.stringify(candidate)).join('\n')}\n`);
  process.stdout.write(`Wrote ${candidates.length} planning eval candidate(s) to ${outputPath}\n`);
}

main();
