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

const STRING_ARRAY_FIELDS = [
  'requirements',
  'assumptions',
  'constraints',
  'affectedAreas',
  'risks',
  'successCriteria',
  'openQuestions',
  'notes',
] as const;

const PREFERRED_STRING_KEYS = ['text', 'description', 'title', 'label', 'criterion'] as const;

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
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Produces stable text for diagnostics and recovered artifact fields.
function truncateDiagnostic(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
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

// Checks whether a copied object placeholder has no usable provider content.
function isEmptyPlaceholderObject(value: Record<string, unknown>) {
  return Object.values(value).every((entry) => {
    if (entry == null) return true;
    if (typeof entry === 'string') return entry.trim().length === 0 || ['string', 'null', 'n/a', 'none'].includes(entry.trim().toLowerCase());
    if (Array.isArray(entry)) return entry.length === 0;
    return false;
  });
}

// Turns common object-array entries into the public string-array contract when the conversion is unambiguous.
function normalizeStringArrayEntry(entry: unknown): string | unknown | null {
  if (entry == null) return null;
  if (typeof entry === 'string') return entry.trim() || null;
  if (typeof entry === 'number' || typeof entry === 'boolean') return String(entry);
  if (!isRecord(entry)) return entry;
  if (isEmptyPlaceholderObject(entry)) return null;

  for (const key of PREFERRED_STRING_KEYS) {
    const value = entry[key];
    if (isNonEmptyString(value)) return value.trim();
  }

  const primitiveValues = Object.values(entry).flatMap((value) => {
    if (isNonEmptyString(value)) return [value.trim()];
    if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
    return [];
  });

  return primitiveValues.length > 0 ? primitiveValues.join(' ') : entry;
}

// Normalizes recoverable string-array entries while preserving unrecoverable objects for strict validation failure.
function normalizeStringArray(value: unknown, fieldPath: string, diagnostics: string[]) {
  if (!Array.isArray(value)) return value;

  const normalized = value.flatMap((entry, index) => {
    const nextEntry = normalizeStringArrayEntry(entry);
    if (nextEntry == null) {
      diagnostics.push(`Dropped empty ${fieldPath}[${index}] placeholder.`);
      return [];
    }
    if (nextEntry !== entry) {
      diagnostics.push(`Normalized ${fieldPath}[${index}] to "${truncateDiagnostic(String(nextEntry))}".`);
    }
    return [nextEntry];
  });

  return normalized;
}

// Applies string-array recovery to implementation task acceptance criteria.
function normalizeImplementationPhases(value: unknown, diagnostics: string[]) {
  if (!Array.isArray(value)) return value;

  return value.map((phase, phaseIndex) => {
    if (!isRecord(phase) || !Array.isArray(phase.tasks)) return phase;

    return {
      ...phase,
      tasks: phase.tasks.map((task, taskIndex) => {
        if (!isRecord(task)) return task;

        return {
          ...task,
          acceptanceCriteria: normalizeStringArray(
            task.acceptanceCriteria,
            `implementationPhases[${phaseIndex}].tasks[${taskIndex}].acceptanceCriteria`,
            diagnostics
          ),
        };
      }),
    };
  });
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

// Repairs known final-plan artifact shape mistakes before the strict public artifact schema is applied.
export function normalizeProviderPlanArtifact(value: unknown): ProviderOutputNormalizationResult {
  const diagnostics: string[] = [];
  if (!isRecord(value)) return { value, diagnostics };

  const normalized = { ...value };

  for (const field of STRING_ARRAY_FIELDS) {
    normalized[field] = normalizeStringArray(normalized[field], field, diagnostics);
  }

  if (isRecord(normalized.scope)) {
    normalized.scope = {
      ...normalized.scope,
      inScope: normalizeStringArray(normalized.scope.inScope, 'scope.inScope', diagnostics),
      outOfScope: normalizeStringArray(normalized.scope.outOfScope, 'scope.outOfScope', diagnostics),
    };
  }

  normalized.technicalDecisions = normalizeTechnicalDecisions(normalized.technicalDecisions, diagnostics);
  normalized.implementationPhases = normalizeImplementationPhases(normalized.implementationPhases, diagnostics);

  return { value: normalized, diagnostics };
}
