/**
 * Agent Execution Tracking Engine — standardized event protocol and domain types.
 *
 * This file defines the single source of truth for agent execution data inside
 * Objectiv. Every event carries a unique id, project id, session id, agent id
 * (where applicable), a timestamp and a payload. Nothing here depends on the DOM
 * or Electron so the engine is fully unit-testable.
 */

export type EventId = string
export type ProjectId = string
export type SessionId = string
export type AgentId = string
export type TaskId = string
export type SubtaskId = string

/** Standardized event types. Keep in sync with the dashboard + every adapter. */
export type AgentEventType =
  | 'PROJECT_CREATED'
  | 'SESSION_CREATED'
  | 'PLAN_CREATED'
  | 'PLAN_UPDATED'
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_STARTED'
  | 'TASK_PROGRESS'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_BLOCKED'
  | 'TASK_UNBLOCKED'
  | 'FILE_CREATED'
  | 'FILE_MODIFIED'
  | 'FILE_DELETED'
  | 'TEST_STARTED'
  | 'TEST_PASSED'
  | 'TEST_FAILED'
  | 'BUILD_STARTED'
  | 'BUILD_PASSED'
  | 'BUILD_FAILED'
  | 'AGENT_STARTED'
  | 'AGENT_IDLE'
  | 'AGENT_COMPLETED'
  | 'AGENT_ERROR'

/** Every standardized event. */
export interface AgentEvent {
  id: EventId
  type: AgentEventType
  projectId: ProjectId
  sessionId: SessionId
  /** undefined when the event is not attributable to a specific agent. */
  agentId?: AgentId
  /** Epoch milliseconds. */
  timestamp: number
  payload: Record<string, unknown>
}

export function makeEventId(): EventId {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** A project groups sessions, agents and tasks under one workspace root. */
export interface Project {
  id: ProjectId
  name: string
  rootPath?: string
  createdAt: number
  updatedAt: number
}

/** A session is one continuous agent execution window within a project. */
export interface Session {
  id: SessionId
  projectId: ProjectId
  name: string
  startedAt: number
  endedAt?: number
}

/** An agent is an AI actor (Claude Code, Codex, Cursor, custom). */
export interface Agent {
  id: AgentId
  sessionId: SessionId
  name: string
  provider: 'claude-code' | 'openai-codex' | 'cursor' | 'custom'
  status: 'active' | 'idle' | 'completed' | 'error'
  currentTaskId?: TaskId
  startedAt: number
  lastActivityAt: number
  errors: string[]
}

/** A unit of work. status is one of: planned | in_progress | completed | failed | blocked | verified */
export type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'failed' | 'blocked' | 'verified'

export interface Task {
  id: TaskId
  projectId: ProjectId
  sessionId?: SessionId
  agentId?: AgentId
  parentId?: TaskId
  title: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high'
  progress: number // 0..100, derived from real subtask/state evidence
  verified: boolean
  verificationEvidence?: string
  dependsOn: TaskId[] // task ids this task cannot start until complete
  blockedReason?: string
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
}

/** A subtask of a task. */
export interface Subtask {
  id: SubtaskId
  taskId: TaskId
  title: string
  status: TaskStatus
  createdAt: number
  completedAt?: number
}

/** A file change attributed to an agent + task when evidence is available. */
export type FileAction = 'create' | 'modify' | 'delete'

export interface FileChange {
  id: string
  projectId: ProjectId
  sessionId: SessionId
  agentId?: AgentId
  taskId?: TaskId
  path: string
  action: FileAction
  timestamp: number
}

/** Evidence-backed verification result for a task. */
export type VerificationStatus = 'passed' | 'failed' | 'pending'

export interface VerificationResult {
  id: string
  taskId: TaskId
  type: 'build' | 'unit-test' | 'integration-test' | 'lint' | 'custom'
  status: VerificationStatus
  evidence: string // what was actually checked (command, output excerpt, file)
  timestamp: number
}

/** A blocker on a task. */
export interface Blocker {
  id: string
  taskId: TaskId
  reason: string
  createdAt: number
  resolvedAt?: number
}

/** Query filters for the event timeline. */
export interface TimelineFilter {
  projectId: ProjectId
  types?: AgentEventType[]
  agentId?: AgentId
  taskId?: TaskId
  sessionId?: SessionId
  from?: number
  to?: number
  limit?: number
}

/** Aggregated project overview for the dashboard. */
export interface ProjectOverview {
  projectId: ProjectId
  totalTasks: number
  plannedTasks: number
  inProgressTasks: number
  completedTasks: number
  failedTasks: number
  blockedTasks: number
  verifiedTasks: number
  verifiedPercent: number // verified / total (0..100), real derived state only
  activeAgents: number
}

/** Roll-up of task counts by status. */
export interface TaskCounts {
  planned: number
  inProgress: number
  completed: number
  failed: number
  blocked: number
  verified: number
}
