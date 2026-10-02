// Registers agent-callable tools and declares which lifecycle states may use each tool.
import { getAllowedAgentToolNamesForState, type AgentRunState, type AgentToolName } from '../domain';
import { askClarificationQuestions, type AskClarificationQuestionsInput } from './askClarificationQuestions';

export type AgentToolDefinition = {
  name: AgentToolName;
  label: string;
  description: string;
};

type AgentToolInputMap = {
  ask_clarification_questions: AskClarificationQuestionsInput;
};

const agentToolDefinitions = [{
  name: 'ask_clarification_questions',
  label: 'Ask clarification questions',
  description: 'Selects one to three structured clarification cards when planning readiness is blocked.',
}] as const satisfies readonly AgentToolDefinition[];

const agentTools = {
  ask_clarification_questions: askClarificationQuestions,
} as const;

// Lists the tools the agent runtime is allowed to call from a specific state.
export function getAllowedAgentToolsForState(state: AgentRunState): AgentToolDefinition[] {
  const allowedToolNames = new Set(getAllowedAgentToolNamesForState(state));
  return agentToolDefinitions.filter((definition) => allowedToolNames.has(definition.name));
}

// Returns true when the named tool is callable from the provided lifecycle state.
export function isAgentToolAllowedForState(toolName: AgentToolName, state: AgentRunState) {
  return getAllowedAgentToolNamesForState(state).includes(toolName);
}

// Executes a registered agent tool only when the current state permits that tool.
export function executeAgentTool<TName extends AgentToolName>({
  toolName,
  state,
  input,
}: {
  toolName: TName;
  state: AgentRunState;
  input: AgentToolInputMap[TName];
}) {
  if (!isAgentToolAllowedForState(toolName, state)) {
    throw new Error(`Agent tool "${toolName}" is not allowed from state "${state}"`);
  }

  return agentTools[toolName](input);
}
