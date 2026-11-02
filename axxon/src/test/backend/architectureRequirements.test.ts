// Verifies plain-language discovery cards and explicit-versus-assumed requirement provenance.
import { describe, expect, it } from 'vitest';
import { getArchitectureDiscoveryQuestions, requirementFromAnswer } from '@/lib/agents/architecture/requirements';

describe('architecture requirements discovery', () => {
  it('asks high-impact questions in an accessible structured format', () => {
    const questions = getArchitectureDiscoveryQuestions();
    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(questions.every((question) => question.prompt && question.whyThisMatters && question.options.length >= 3)).toBe(true);
  });

  it('records a default as an assumption rather than an explicit requirement', () => {
    const question = getArchitectureDiscoveryQuestions()[0];
    const requirement = requirementFromAnswer(question, { questionKey: question.questionKey, selectedOptionKey: 'default' });
    expect(requirement.status).toBe('assumed');
    expect(requirement.source).toBe('agent_default');
    expect(requirement.answer_json).toEqual({ selectedOptionKey: 'default', note: null });
  });
});
