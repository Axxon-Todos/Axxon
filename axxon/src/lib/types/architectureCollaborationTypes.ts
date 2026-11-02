// Defines project collaboration records shared by persistence, APIs, hooks, and feature components.
export type ArchitectureCommentThreadStatus = 'open' | 'resolved';

export type ArchitectureCommentThread = {
  id: number;
  project_id: number;
  component_id: string | null;
  relationship_id: string | null;
  revision_id: number | null;
  proposal_run_id: number | null;
  status: ArchitectureCommentThreadStatus;
  created_by: number;
  resolved_by: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  comments?: ArchitectureComment[];
};

export type ArchitectureComment = {
  id: number;
  thread_id: number;
  author_id: number;
  author_type: 'human' | 'agent';
  body: string;
  mentions: string[];
  created_at: string;
};

export type ArchitectureCollaborationEvent = {
  id: number;
  project_id: number;
  actor_id: number | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};
