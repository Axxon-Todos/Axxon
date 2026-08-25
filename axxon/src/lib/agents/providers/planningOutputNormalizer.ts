// Normalizes recoverable local-model planning JSON mistakes before strict domain validation.
import {
  agentPlanningDecisionActions,
  agentPlanningDecisionReasons,
  agentQuestionCategories,
  agentTechnicalDecisionSources,
  type AgentPlanningDecisionAction,
  type AgentPlanningDecisionReason,
} from '../domain';

export type ProviderOutputNormalizationResult = {
  value: unknown;
  diagnostics: string[];
};

const ASK_QUESTION_REASON_ORDER: AgentPlanningDecisionReason[] = [
  'missing_objective',
  'scope_unbounded',
  'missing_acceptance_criteria',
  'blocking_unknowns',
  'low_confidence',
];

// Checks whether an unknown provider value can be safely inspected as an object.
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

// Detects strings that can satisfy required provider fields.
function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Extracts valid enum members from a copied placeholder such as "a|b|c".
function parseEnumUnion<T extends string>(value: unknown, allowedValues: readonly T[]) {
  if (typeof value !== 'string' || !value.includes('|')) return null;

  const allowedSet = new Set<string>(allowedValues);
  const values = value
    .split('|')
    .map((part) => part.trim())
    .filter((part): part is T => allowedSet.has(part));

  return values.length > 0 ? values : null;
}

// Converts a copied action placeholder into the conservative planning action.
function normalizeAction(value: unknown, diagnostics: string[]): AgentPlanningDecisionAction | unknown {
  if (typeof value !== 'string' || !value.includes('|')) return value;

  const values = parseEnumUnion(value, agentPlanningDecisionActions);
  if (!values) return value;

  diagnostics.push(`Normalized copied decision.action enum union "${value}" to "ask_questions".`);
  return 'ask_questions';
}

// Checks whether an array carries at least one usable string signal.
function hasStringArrayValue(value: unknown) {
  return Array.isArray(value) && value.some(isNonEmptyString);
}

// Picks the most specific clarification reason from copied reason placeholders and context clues.
function inferAskQuestionReason(root: Record<string, unknown>, reasonValues: AgentPlanningDecisionReason[]) {
  const contextPatch = isRecord(root.contextPatch) ? root.contextPatch : {};
  const objective = contextPatch.objective;
  const acceptanceCriteria = contextPatch.acceptanceCriteria;
  const blockingUnknowns = root.blockingUnknowns ?? contextPatch.blockingUnknowns;
  const unresolvedUnknowns = root.unresolvedUnknowns ?? contextPatch.unresolvedUnknowns;
  const inScope = contextPatch.inScope;
  const outOfScope = contextPatch.outOfScope;

  if (reasonValues.includes('missing_objective') && (!isNonEmptyString(objective) || objective === null)) {
    return 'missing_objective';
  }

  if (
    reasonValues.includes('missing_acceptance_criteria') &&
    (!hasStringArrayValue(acceptanceCriteria))
  ) {
    return 'missing_acceptance_criteria';
  }

  if (
    reasonValues.includes('blocking_unknowns') &&
    (hasStringArrayValue(blockingUnknowns) || hasStringArrayValue(unresolvedUnknowns))
  ) {
    return 'blocking_unknowns';
  }

  if (
    reasonValues.includes('scope_unbounded') &&
    (!hasStringArrayValue(inScope) && !hasStringArrayValue(outOfScope))
  ) {
    return 'scope_unbounded';
  }

  return ASK_QUESTION_REASON_ORDER.find((reason) => reasonValues.includes(reason)) ?? 'low_confidence';
}

// Converts copied reason placeholders into one valid decision reason.
function normalizeReason({
  action,
  reason,
  root,
  diagnostics,
}: {
  action: unknown;
  reason: unknown;
  root: Record<string, unknown>;
  diagnostics: string[];
}) {
  const reasonValues = parseEnumUnion(reason, agentPlanningDecisionReasons);
  if (!reasonValues) return reason;

  let normalizedReason: AgentPlanningDecisionReason;
  if (action === 'complete_planning') {
    normalizedReason = reasonValues.includes('requirements_satisfied') ? 'requirements_satisfied' : 'low_confidence';
  } else if (action === 'respond') {
    normalizedReason = reasonValues.includes('missing_objective') ? 'missing_objective' : 'low_confidence';
  } else {
    normalizedReason = inferAskQuestionReason(root, reasonValues);
  }

  diagnostics.push(`Normalized copied decision.reason enum union "${reason}" to "${normalizedReason}".`);
  return normalizedReason;
}

// Repairs known technical-decision enum placeholders without treating them as clarified facts.
function normalizeTechnicalDecision(entry: unknown, diagnostics: string[]) {
  if (!isRecord(entry)) return entry;

  const normalizedEntry = { ...entry };
  if (normalizedEntry.source === 'explicit|clarified|assumed') {
    normalizedEntry.source = 'assumed';
    diagnostics.push('Normalized copied technicalDecisions.source enum union to "assumed".');
  }

  return normalizedEntry;
}

// Removes empty technical-decision examples that local models copy from JSON skeletons.
function normalizeTechnicalDecisions(value: unknown, diagnostics: string[]) {
  if (!Array.isArray(value)) return value;

  const normalized = value
    .filter((entry) => {
      if (!isRecord(entry)) return true;
      const isEmptyPlaceholder = ['area', 'choice', 'rationale', 'source'].every((key) => entry[key] == null);
      if (isEmptyPlaceholder) diagnostics.push('Dropped empty technical decision placeholder.');
      return !isEmptyPlaceholder;
    })
    .map((entry) => normalizeTechnicalDecision(entry, diagnostics));

  return normalized;
}

// Validates the provider question object enough to decide whether strict schema parsing can handle it.
function hasUsableCandidateQuestionShape(entry: Record<string, unknown>) {
  if (
    !isNonEmptyString(entry.questionKey) ||
    !isNonEmptyString(entry.category) ||
    !isNonEmptyString(entry.prompt) ||
    !isNonEmptyString(entry.whyThisMatters)
  ) {
    return false;
  }

  if (!Array.isArray(entry.options) || entry.options.length !== 3) return false;

  return entry.options.every((option) =>
    isRecord(option) &&
    isNonEmptyString(option.optionKey) &&
    isNonEmptyString(option.label) &&
    isNonEmptyString(option.description)
  );
}

// Drops unusable candidate question cards so deterministic fallback questions can take over.
function normalizeCandidateQuestions(value: unknown, diagnostics: string[]) {
  if (!Array.isArray(value)) return value;

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      diagnostics.push('Dropped non-object candidate question.');
      return [];
    }

    if (parseEnumUnion(entry.category, agentQuestionCategories)) {
      diagnostics.push('Dropped candidate question with copied category enum union.');
      return [];
    }

    if (!hasUsableCandidateQuestionShape(entry)) {
      diagnostics.push('Dropped incomplete candidate question.');
      return [];
    }

    return [entry];
  });
}

// Repairs known Ollama placeholder-copying mistakes while preserving strict schema validation afterward.
export function normalizeProviderPlanningTurnAnalysis(value: unknown): ProviderOutputNormalizationResult {
  const diagnostics: string[] = [];
  if (!isRecord(value)) return { value, diagnostics };

  const normalized = { ...value };

  if (isRecord(normalized.contextPatch)) {
    normalized.contextPatch = {
      ...normalized.contextPatch,
      technicalDecisions: normalizeTechnicalDecisions(normalized.contextPatch.technicalDecisions, diagnostics),
    };
  }

  normalized.candidateQuestions = normalizeCandidateQuestions(normalized.candidateQuestions, diagnostics);

  if (isRecord(normalized.decision)) {
    const decision = { ...normalized.decision };
    decision.action = normalizeAction(decision.action, diagnostics);
    decision.reason = normalizeReason({
      action: decision.action,
      reason: decision.reason,
      root: normalized,
      diagnostics,
    });
    normalized.decision = decision;
  }

  return { value: normalized, diagnostics };
}
