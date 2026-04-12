// Describes persisted org AI chat threads, messages, and org-scoped API request contracts.
export type OrganizationAiChatMessageRole = 'user' | 'assistant';

export type OrganizationAiChatMessageStatus = 'completed' | 'failed';

export type OrganizationAiChatThread = {
  id: number;
  organization_id: number;
  created_by: number;
  title: string;
  summary: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationAiChatMessage = {
  id: number;
  thread_id: number;
  role: OrganizationAiChatMessageRole;
  content: string;
  sequence_number: number;
  status: OrganizationAiChatMessageStatus;
  model: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationAiChatThreadDetail = {
  thread: OrganizationAiChatThread;
  messages: OrganizationAiChatMessage[];
};

export type OrganizationAiChatRequest = {
  threadId?: number;
  content: string;
};

export type OrganizationAiGeneratedThreadMetadata = {
  title: string;
  summary: string;
};
