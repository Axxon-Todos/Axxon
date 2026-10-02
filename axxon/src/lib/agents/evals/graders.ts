// Scores planning-agent eval traces with deterministic product, schema, and architecture checks.
import { agentPlanArtifactSchema, agentQuestionSchema } from '../domain/schemas';
import { resolveAgentTransition } from '../domain/stateMachine';
import type { AgentPlanArtifact } from '../domain/contracts';
import type { PlanningEvalCase, PlanningEvalGrade, PlanningEvalIssue, PlanningEvalTrace } from './types';

function flattenArtifactText(artifact: AgentPlanArtifact | null) {
  if (!artifact) return '';

  return [
    artifact.summary,
    artifact.objective,
    ...artifact.scope.inScope,
    ...artifact.scope.outOfScope,
    ...artifact.requirements,
    ...artifact.assumptions,
    ...artifact.constraints,
    ...artifact.affectedAreas,
    ...artifact.technicalDecisions.flatMap((decision) => [decision.area, decision.choice, decision.rationale, decision.source]),
    ...artifact.implementationPhases.flatMap((phase) => [
      phase.id,
      phase.title,
      phase.summary,
      ...phase.tasks.flatMap((task) => [
        task.id,
        task.title,
        task.description,
        task.type,
        task.priority,
        ...task.dependencyIds,
        ...task.acceptanceCriteria,
      ]),
    ]),
    ...artifact.risks,
    ...artifact.successCriteria,
    ...artifact.openQuestions,
    ...artifact.notes,
  ].join(' ').toLowerCase();
}

function pushIssue(issues: PlanningEvalIssue[], issue: PlanningEvalIssue) {
  if (issues.some((existing) => existing.code === issue.code)) return;
  issues.push({ ...issue, evidence: issue.evidence.slice(0, 8) });
}

function includesTerm(text: string, term: string) {
  return text.includes(term.toLowerCase());
}

function gradeArchitectureRules(evalCase: PlanningEvalCase, trace: PlanningEvalTrace, issues: PlanningEvalIssue[]) {
  const artifactText = flattenArtifactText(trace.planArtifact);
  const messageText = trace.messages.map((message) => message.content).join(' ').toLowerCase();
  const text = `${artifactText} ${messageText}`;

  for (const rule of evalCase.expected.architectureRules) {
    if (rule === 'org_first' && (text.includes('/dashboard/boards') || text.includes('/api/boards') || text.includes('board-first'))) {
      pushIssue(issues, {
        code: 'architecture_org_first_violation',
        severity: 'error',
        message: 'Output reintroduced board-first routes or language.',
        evidence: ['/dashboard/boards', '/api/boards', 'board-first'].filter((term) => text.includes(term)),
      });
    }

    if (rule === 'agent_backend_only' && text.includes('socket.io process') && text.includes('agent worker')) {
      pushIssue(issues, {
        code: 'architecture_agent_backend_violation',
        severity: 'error',
        message: 'Output suggests running agent worker behavior inside the Socket.IO process.',
        evidence: ['socket.io process', 'agent worker'],
      });
    }

    const githubWriteViolation =
      /\b(push|commit|merge)\b.{0,40}\b(github|pull request|pr)\b/i.test(text) ||
      /\b(github|pull request|pr)\b.{0,40}\b(push|commit|merge)\b/i.test(text);
    if (rule === 'no_github_writes_before_approval' && githubWriteViolation) {
      pushIssue(issues, {
        code: 'architecture_github_write_violation',
        severity: 'error',
        message: 'Output suggests GitHub writes before explicit plan approval.',
        evidence: ['GitHub write before approval'],
      });
    }

    if (rule === 'no_legacy_board_routes' && (text.includes('/api/boards') || text.includes('/dashboard/boards'))) {
      pushIssue(issues, {
        code: 'architecture_legacy_route_violation',
        severity: 'error',
        message: 'Output references legacy board-only route shapes.',
        evidence: ['/api/boards', '/dashboard/boards'].filter((term) => text.includes(term)),
      });
    }
  }
}

function gradeClarificationShape(trace: PlanningEvalTrace, issues: PlanningEvalIssue[]) {
  for (const question of trace.questions) {
    const parsed = agentQuestionSchema.safeParse(question);
    if (!parsed.success) {
      pushIssue(issues, {
        code: 'invalid_clarification_question_schema',
        severity: 'error',
        message: 'Clarification question failed the shared question schema.',
        evidence: [question.questionKey],
      });
      continue;
    }

    const recommendedCount = question.options.filter((option) => option.isRecommended).length;
    if (question.options.length < 3 || question.options.length > 4 || recommendedCount !== 1) {
      pushIssue(issues, {
        code: 'invalid_clarification_options',
        severity: 'error',
        message: 'Clarification cards need three concrete options plus optional none-of-the-above and exactly one recommendation.',
        evidence: [question.questionKey],
      });
    }
  }
}

function calculateScore(issues: PlanningEvalIssue[]) {
  return Math.max(0, 100 - issues.reduce((total, issue) => {
    if (issue.severity === 'error') return total + 25;
    if (issue.severity === 'warning') return total + 10;
    return total + 2;
  }, 0));
}

// Applies deterministic eval gates to one completed trace.
export function gradePlanningEvalTrace(evalCase: PlanningEvalCase, trace: PlanningEvalTrace): PlanningEvalGrade {
  const issues: PlanningEvalIssue[] = [];
  const artifactText = flattenArtifactText(trace.planArtifact);

  if (trace.failureMessage) {
    pushIssue(issues, {
      code: 'eval_runtime_failure',
      severity: 'error',
      message: trace.failureMessage,
      evidence: [trace.finalState],
    });
  }

  for (const transition of trace.transitions) {
    const resolved = resolveAgentTransition(transition.fromState, transition.event);
    if (resolved !== transition.toState) {
      pushIssue(issues, {
        code: 'illegal_state_transition',
        severity: 'error',
        message: 'Trace contains a transition outside the agent state machine.',
        evidence: [`${transition.fromState} --${transition.event}--> ${transition.toState}`],
      });
    }
  }

  if (evalCase.expected.finalState && trace.finalState !== evalCase.expected.finalState) {
    pushIssue(issues, {
      code: 'unexpected_final_state',
      severity: 'error',
      message: `Expected final state ${evalCase.expected.finalState}, received ${trace.finalState}.`,
      evidence: [trace.finalState],
    });
  }

  if (evalCase.expected.decisionAction && trace.finalDecisionAction !== evalCase.expected.decisionAction) {
    pushIssue(issues, {
      code: 'unexpected_decision_action',
      severity: 'error',
      message: `Expected decision action ${evalCase.expected.decisionAction}, received ${trace.finalDecisionAction}.`,
      evidence: [String(trace.finalDecisionAction)],
    });
  }

  if (evalCase.expected.shouldAskClarification && trace.finalState !== 'awaiting_input') {
    pushIssue(issues, {
      code: 'expected_clarification_input',
      severity: 'error',
      message: 'Expected the planning run to request structured clarification input.',
      evidence: [trace.finalState],
    });
  }

  if (evalCase.expected.shouldUseAwaitingMessage && trace.finalState !== 'awaiting_message') {
    pushIssue(issues, {
      code: 'expected_free_form_message',
      severity: 'error',
      message: 'Expected the planning run to request a free-form planning message.',
      evidence: [trace.finalState],
    });
  }

  if (evalCase.expected.requirePlanArtifact && !trace.planArtifact) {
    pushIssue(issues, {
      code: 'missing_plan_artifact',
      severity: 'error',
      message: 'Expected a generated plan artifact.',
      evidence: [trace.finalState],
    });
  }

  if (trace.planArtifact) {
    const parsedArtifact = agentPlanArtifactSchema.safeParse(trace.planArtifact);
    if (!parsedArtifact.success) {
      pushIssue(issues, {
        code: 'invalid_plan_artifact_schema',
        severity: 'error',
        message: 'Plan artifact failed the shared artifact schema.',
        evidence: ['AgentPlanArtifact'],
      });
    }
  }

  if (evalCase.expected.mustPassQuality && trace.quality && !trace.quality.passed) {
    pushIssue(issues, {
      code: 'plan_quality_failed',
      severity: 'error',
      message: 'Plan artifact did not pass deterministic quality checks.',
      evidence: trace.quality.issues.map((issue) => issue.code),
    });
  }

  if (trace.quality && trace.quality.score < evalCase.expected.minQualityScore) {
    pushIssue(issues, {
      code: 'plan_quality_score_too_low',
      severity: 'error',
      message: `Plan quality score ${trace.quality.score} is below ${evalCase.expected.minQualityScore}.`,
      evidence: [String(trace.quality.score)],
    });
  }

  for (const issueCode of evalCase.expected.disallowedQualityIssueCodes) {
    if (trace.quality?.issues.some((issue) => issue.code === issueCode)) {
      pushIssue(issues, {
        code: 'disallowed_quality_issue',
        severity: 'error',
        message: `Plan quality issue "${issueCode}" is disallowed for this case.`,
        evidence: [issueCode],
      });
    }
  }

  if (evalCase.expected.maxClarificationTurns !== undefined && trace.transitions.filter((transition) => transition.event === 'input.required').length > evalCase.expected.maxClarificationTurns) {
    pushIssue(issues, {
      code: 'too_many_clarification_turns',
      severity: 'error',
      message: 'Planning run exceeded the allowed clarification turn count.',
      evidence: [String(evalCase.expected.maxClarificationTurns)],
    });
  }

  if (evalCase.expected.minQuestionCount !== undefined && trace.questions.length < evalCase.expected.minQuestionCount) {
    pushIssue(issues, {
      code: 'too_few_questions',
      severity: 'error',
      message: 'Planning run returned fewer clarification cards than expected.',
      evidence: [String(trace.questions.length)],
    });
  }

  if (evalCase.expected.maxQuestionCount !== undefined && trace.questions.length > evalCase.expected.maxQuestionCount) {
    pushIssue(issues, {
      code: 'too_many_questions',
      severity: 'error',
      message: 'Planning run returned more clarification cards than expected.',
      evidence: [String(trace.questions.length)],
    });
  }

  for (const term of evalCase.expected.requiredTerms) {
    if (!includesTerm(artifactText, term) && !trace.questions.some((question) => includesTerm(`${question.prompt} ${question.whyThisMatters} ${question.options.map((option) => `${option.label} ${option.description}`).join(' ')}`, term))) {
      pushIssue(issues, {
        code: 'missing_required_term',
        severity: 'error',
        message: `Output does not include required term "${term}".`,
        evidence: [term],
      });
    }
  }

  for (const term of evalCase.expected.forbiddenTerms) {
    if (includesTerm(artifactText, term)) {
      pushIssue(issues, {
        code: 'forbidden_term_present',
        severity: 'error',
        message: `Output includes forbidden term "${term}".`,
        evidence: [term],
      });
    }
  }

  gradeClarificationShape(trace, issues);
  gradeArchitectureRules(evalCase, trace, issues);

  const deterministicScore = calculateScore(issues);

  return {
    caseId: evalCase.id,
    passed: deterministicScore >= 70 && !issues.some((issue) => issue.severity === 'error'),
    deterministicScore,
    issues,
    judge: null,
  };
}
