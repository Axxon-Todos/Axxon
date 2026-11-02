// Defines accessible architecture discovery questions and converts answers into traceable requirements.
import type { AgentClarificationAnswer, AgentQuestion, AgentQuestionCategory } from '@/lib/agents/domain';

export type ArchitectureDiscoveryQuestion = AgentQuestion & {
  requirementKey: string;
  requirementTitle: string;
  requirementCategory: 'security' | 'infrastructure' | 'reliability' | 'data';
};

export const architectureDiscoveryQuestions: ArchitectureDiscoveryQuestion[] = [
  {
    questionKey: 'security-impact', requirementKey: 'security-impact', requirementTitle: 'Security impact', category: 'technical', requirementCategory: 'security',
    prompt: 'How serious would it be if someone unauthorized accessed the system data?',
    whyThisMatters: 'This determines how strongly we should prioritize isolation, encryption, access controls, and audit trails.', required: true, blocking: true,
    options: [
      { optionKey: 'low', label: 'Inconvenient but recoverable', description: 'The data is low sensitivity and exposure would be limited.' },
      { optionKey: 'high', label: 'Could seriously harm users or the business', description: 'Use stronger access controls, encryption, and auditability.', isRecommended: true },
      { optionKey: 'critical', label: 'Could create legal, safety, or major financial consequences', description: 'Treat security and compliance as architecture gates.' },
      { optionKey: 'default', label: 'I am not sure', description: 'Use a cautious default and mark this as an assumption.' },
    ],
  },
  {
    questionKey: 'availability-expectation', requirementKey: 'availability-expectation', requirementTitle: 'Availability expectation', category: 'constraints', requirementCategory: 'reliability',
    prompt: 'What should happen if the system has a temporary outage?',
    whyThisMatters: 'This influences redundancy, graceful degradation, recovery targets, and operational complexity.', required: true, blocking: true,
    options: [
      { optionKey: 'can_pause', label: 'It is okay to pause and recover later', description: 'Prefer a simpler design with clear recovery steps.' },
      { optionKey: 'limited', label: 'Short interruptions are acceptable', description: 'Add health checks and recovery automation.', isRecommended: true },
      { optionKey: 'always', label: 'Core workflows must keep working', description: 'Design for redundancy and failover around critical paths.' },
      { optionKey: 'default', label: 'I am not sure', description: 'Use a practical default and mark this as an assumption.' },
    ],
  },
  {
    questionKey: 'expected-scale', requirementKey: 'expected-scale', requirementTitle: 'Expected scale', category: 'technical', requirementCategory: 'infrastructure',
    prompt: 'How much usage do you expect at the busiest point?',
    whyThisMatters: 'Scale affects hosting shape, caching, capacity planning, and whether we need to distribute work.', required: true, blocking: true,
    options: [
      { optionKey: 'small', label: 'Small team or early product', description: 'Optimize for simplicity and easy iteration.', isRecommended: true },
      { optionKey: 'growing', label: 'Growing usage with occasional spikes', description: 'Keep the design easy to scale horizontally.' },
      { optionKey: 'large', label: 'Large or unpredictable public usage', description: 'Plan capacity, isolation, and resilience from the beginning.' },
      { optionKey: 'default', label: 'I am not sure', description: 'Use a modest starting point and mark this as an assumption.' },
    ],
  },
  {
    questionKey: 'data-lifecycle', requirementKey: 'data-lifecycle', requirementTitle: 'Data lifecycle', category: 'constraints', requirementCategory: 'data',
    prompt: 'What should happen to important data over time?',
    whyThisMatters: 'Retention, deletion, recovery, and ownership rules shape storage, backups, and privacy behavior.', required: true, blocking: true,
    options: [
      { optionKey: 'temporary', label: 'Most data can be temporary', description: 'Keep storage and deletion workflows simple.' },
      { optionKey: 'retain', label: 'Data must be retained for the product', description: 'Design explicit ownership, backups, and migrations.', isRecommended: true },
      { optionKey: 'regulated', label: 'Some data has strict retention or deletion rules', description: 'Add lifecycle controls and treat policy as a design constraint.' },
      { optionKey: 'default', label: 'I am not sure', description: 'Assume important data should be retained safely.' },
    ],
  },
];

// Returns the initial question batch for an architecture bootstrap.
export function getArchitectureDiscoveryQuestions(): ArchitectureDiscoveryQuestion[] {
  return architectureDiscoveryQuestions.map((question) => ({ ...question, options: question.options.map((option) => ({ ...option })) }));
}

// Converts an answer into a plain-language requirement and records whether it was explicit or assumed.
export function requirementFromAnswer(question: ArchitectureDiscoveryQuestion, answer: AgentClarificationAnswer) {
  const selected = answer.selectedOptionKey || answer.selectedOptionKeys?.[0] || 'default';
  const option = question.options.find((candidate) => candidate.optionKey === selected) || question.options.find((candidate) => candidate.optionKey === 'default')!;
  const assumed = option.optionKey === 'default';
  return {
    key: question.requirementKey,
    title: question.requirementTitle,
    statement: `${question.prompt} — ${option.label}.`,
    category: question.requirementCategory,
    priority: question.blocking ? 'high' : 'medium',
    status: assumed ? 'assumed' : 'confirmed',
    source: assumed ? 'agent_default' : 'clarified',
    rationale: option.description,
    answer_json: { selectedOptionKey: option.optionKey, note: answer.note || null },
    blocking: question.blocking,
  };
}
