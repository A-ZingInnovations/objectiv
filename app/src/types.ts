export type FileActions = Array<
  | { type: 'create_file'; path: string; content: string }
  | { type: 'edit_file'; path: string; content: string }
>;

export type PendingEdit = {
  callId: string;
  tool: string;
  path?: string;
  before?: string;
  after?: string;
  command?: string;
  message?: string;
  title: string;
};

export type AgentMessage = {
  role: 'user' | 'assistant';
  content: string;
  actions?: FileActions;
  pending?: PendingEdit;
  labels?: string[];
  runId?: string;
};
