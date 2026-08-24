// Registers agent tool implementations behind a stable tool-call dispatch contract.
import { askClarificationQuestions, type AskClarificationQuestionsInput } from './askClarificationQuestions';

export type AgentToolName = 'ask_clarification_questions';

type AgentToolInputMap = {
  ask_clarification_questions: AskClarificationQuestionsInput;
};

const agentTools = {
  ask_clarification_questions: askClarificationQuestions,
} as const;

// Executes a registered agent tool with the input type associated with its tool name.
export function executeAgentTool<TName extends AgentToolName>(
  toolName: TName,
  input: AgentToolInputMap[TName]
) {
  return agentTools[toolName](input);
}
