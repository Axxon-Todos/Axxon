# Planning Agent Evals

The planning eval pipeline measures the whole Axxon planning-agent workflow: provider analysis, clarification cards, readiness, final plan artifacts, deterministic quality, retries, and optional LLM judge scoring. It is repo-owned so CI can run it without depending on a managed eval service.

## Commands

Run commands from `axxon/`.

- `pnpm eval:planning:smoke`: required fixture-backed CI gate for fast regressions.
- `pnpm eval:planning:golden`: broader golden regression run; defaults to `EVAL_PLANNING_PROVIDER` or fixture.
- `pnpm eval:planning:judge`: judge-calibration run using `EVAL_JUDGE_API_KEY`, `EVAL_JUDGE_BASE_URL`, and `EVAL_JUDGE_MODEL`.
- `pnpm eval:planning:release`: golden run with required judge scoring and baseline comparison.
- `pnpm eval:planning:update-baseline`: refreshes `evals/planning/baselines/current.json` from fixture golden results.
- `pnpm eval:planning:mine`: converts exported production traces from `EVAL_TRACE_EXPORT_PATH` into gitignored inbox candidates.

Reports are written to `.eval-runs/planning/<timestamp>/` and are not committed.

## Dataset Structure

Committed eval cases live in `evals/planning/cases/*.jsonl`.

- `smoke.jsonl`: small deterministic PR gate.
- `golden.jsonl`: curated regression suite for release and nightly runs.
- `judge-calibration.jsonl`: human-labeled cases for checking judge behavior.
- `inbox/*.jsonl`: gitignored sanitized production candidates that must be reviewed before promotion.

Each row defines the prompt, expected behavior, optional scripted clarification answers, and fixture provider outputs. Fixture cases should be deterministic and should cover known failure modes before they are promoted into `golden.jsonl`.

## Evaluation Stages

- PR smoke eval blocks schema, state-machine, clarification, and plan-quality regressions without live model calls.
- Golden eval compares planning behavior against a repeatable dataset before release or during nightly checks.
- LLM-as-judge eval scores subjective plan quality that deterministic checks cannot fully capture.
- Judge calibration compares judge scores with human labels and fails when agreement falls below the configured bar.
- Baseline comparison prevents a candidate run from silently getting worse than the committed golden fixture baseline.
- Production trace mining turns real misses into candidate eval cases after redaction and human review.

## Judge Configuration

Judge runs use an OpenAI-compatible `/chat/completions` endpoint.

- `EVAL_JUDGE_API_KEY`: judge provider key.
- `EVAL_JUDGE_BASE_URL`: base URL for the judge provider.
- `EVAL_JUDGE_MODEL`: model name to use for judge scoring.
- `EVAL_JUDGE_MOCK=1`: local deterministic mock judge for testing the eval path without an external provider.

The judge returns strict JSON with overall and dimension scores. Deterministic gates remain authoritative for security, schema, state-machine, and Axxon architecture rules.
