/**
 * Event store — in-memory event log plus persistence.
 *
 * Web: persisted to localStorage under `objectiv-agent-execution-v1` so history
 * survives application restarts.
 * Electron (desktop): additionally mirrored to `.objectiv/agent-execution.json`
 * under the open workspace root via `desktopWorkspace` so it survives across
 * machines / workspaces.
 *
 * The store is append-only: events are never mutated or deleted, preserving the
 * full execution history.
 */

import type {
  AgentEvent,
  Project,
  ProjectId,
  Session,
  SessionId,
  Agent,
  AgentId,
  Task,
  TaskId,
  Subtask,
  SubtaskId,
  FileChange,
  VerificationResult,
  Blocker,
  TaskStatus,
  TimelineFilter,
  ProjectOverview,
  AgentEventType,
  TaskCounts,
} from './types'
import { makeEventId, makeId } from './types'
import { isElectronDesktop } from '../desktopWorkspace'
import {
  getAgentExecutionDiskRoot,
  mirrorStoreToWorkspace,
} from './persistence'

const STORAGE_KEY = 'objectiv-agent-execution-v1'

/** Snapshot of everything the store holds. */
export interface AgentExecutionStore {
  version: number
  projects: Record<ProjectId, Project>
  sessions: Record<SessionId, Session>
  agents: Record<AgentId, Agent>
  tasks: Record<TaskId, Task>
  subtasks: Record<SubtaskId, Subtask>
  events: AgentEvent[]
  fileChanges: FileChange[]
  verificationResults: VerificationResult[]
  blockers: Record<string, Blocker>
}

const EMPTY_STORE: AgentExecutionStore = {
  version: 1,
  projects: {},
  sessions: {},
  agents: {},
  tasks: {},
  subtasks: {},
  events: [],
  fileChanges: [],
  verificationResults: [],
  blockers: {},
}

/** Read the persisted store, falling back to empty. */
export function loadStore(): AgentExecutionStore {
  if (typeof localStorage === 'undefined') return structuredClone(EMPTY_STORE)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(EMPTY_STORE)
    const parsed = JSON.parse(raw) as Partial<AgentExecutionStore>
    return { ...structuredClone(EMPTY_STORE), ...parsed }
  } catch {
    return structuredClone(EMPTY_STORE)
  }
}

/** Persist the store to localStorage (best effort, never throws). */
export function saveStore(store: AgentExecutionStore): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota / private-mode — history is still kept in memory this session */
  }
}

/** Mirror to disk when a workspace root is registered (Electron only). */
export async function mirrorStoreToDisk(store: AgentExecutionStore): Promise<void> {
  if (!isElectronDesktop()) return
  const root = getAgentExecutionDiskRoot()
  if (!root) return
  await mirrorStoreToWorkspace(root, store)
}

export type EventStoreApi = {
  /** All events, newest first. */
  events(): AgentEvent[]
  /** Events matching a timeline filter. */
  timeline(filter: TimelineFilter): AgentEvent[]
  eventsForProject(projectId: ProjectId): AgentEvent[]
  eventsForSession(sessionId: SessionId): AgentEvent[]
  eventsForAgent(agentId: AgentId): AgentEvent[]
  eventsForTask(taskId: TaskId): AgentEvent[]
  emit(event: Omit<AgentEvent, 'id' | 'timestamp'>): AgentEvent

  projects(): Project[]
  getProject(id: ProjectId): Project | undefined
  createProject(name: string, rootPath?: string): Project

  sessions(): Session[]
  getSession(id: SessionId): Session | undefined
  createSession(projectId: ProjectId, name: string): Session
  endSession(sessionId: SessionId): void

  agents(): Agent[]
  getAgent(id: AgentId): Agent | undefined
  createAgent(opts: {
    sessionId: SessionId
    name: string
    provider: Agent['provider']
  }): Agent
  setAgentStatus(agentId: AgentId, status: Agent['status']): void
  setAgentCurrentTask(agentId: AgentId, taskId?: TaskId): void
  recordAgentError(agentId: AgentId, message: string): void

  tasks(): Task[]
  getTask(id: TaskId): Task | undefined
  createTask(opts: {
    projectId: ProjectId
    sessionId?: SessionId
    agentId?: AgentId
    parentId?: TaskId
    title: string
    status?: TaskStatus
    priority?: Task['priority']
    dependsOn?: TaskId[]
  }): Task
  updateTask(id: TaskId, patch: Partial<Task>): Task | undefined
  setTaskStatus(id: TaskId, status: TaskStatus): Task | undefined
  setTaskProgress(id: TaskId, progress: number): Task | undefined
  setTaskVerified(id: TaskId, verified: boolean, evidence?: string): Task | undefined
  addTaskDependency(taskId: TaskId, dependsOn: TaskId): void
  setTaskBlocked(taskId: TaskId, reason: string): void
  setTaskUnblocked(taskId: TaskId): void

  subtasks(): Subtask[]
  createSubtask(opts: { taskId: TaskId; title: string }): Subtask
  setSubtaskStatus(subtaskId: SubtaskId, status: TaskStatus): void

  fileChanges(): FileChange[]
  recordFileChange(opts: {
    projectId: ProjectId
    sessionId: SessionId
    agentId?: AgentId
    taskId?: TaskId
    path: string
    action: FileChange['action']
  }): FileChange

  verificationResults(): VerificationResult[]
  recordVerification(opts: {
    taskId: TaskId
    type: VerificationResult['type']
    status: VerificationResult['status']
    evidence: string
  }): VerificationResult

  blockers(): Blocker[]
  createBlocker(opts: { taskId: TaskId; reason: string }): Blocker
  resolveBlocker(blockerId: string): void

  /** Aggregate project overview for the dashboard. */
  projectOverview(projectId: ProjectId): ProjectOverview

  save(): void

  /** React subscription — fires after every mutating operation. */
  subscribe(listener: () => void): () => void
  getRevision(): number
}

/** Build the event-store API from a persisted store. */
export function createEventStore(initial?: AgentExecutionStore): EventStoreApi {
  const store: AgentExecutionStore = initial ?? loadStore()
  let revision = 0
  const listeners = new Set<() => void>()

  function notify(): void {
    revision += 1
    for (const listener of listeners) listener()
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getRevision(): number {
    return revision
  }

  function persist() {
    saveStore(store)
    void mirrorStoreToDisk(store)
    notify()
  }

  function now(): number {
    return Date.now()
  }

  function events(): AgentEvent[] {
    return [...store.events].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id))
  }

  function timeline(filter: TimelineFilter): AgentEvent[] {
    return events().filter((e) => {
      if (e.projectId !== filter.projectId) return false
      if (filter.types && !filter.types.includes(e.type)) return false
      if (filter.agentId && e.agentId !== filter.agentId) return false
      if (filter.sessionId && e.sessionId !== filter.sessionId) return false
      if (filter.taskId && e.payload.taskId !== filter.taskId) return false
      if (filter.from && e.timestamp < filter.from) return false
      if (filter.to && e.timestamp > filter.to) return false
      return true
    })
  }

  function eventsForProject(projectId: ProjectId): AgentEvent[] {
    return events().filter((e) => e.projectId === projectId)
  }

  function eventsForSession(sessionId: SessionId): AgentEvent[] {
    return events().filter((e) => e.sessionId === sessionId)
  }

  function eventsForAgent(agentId: AgentId): AgentEvent[] {
    return events().filter((e) => e.agentId === agentId)
  }

  function eventsForTask(taskId: TaskId): AgentEvent[] {
    return events().filter((e) => {
      if (e.payload.taskId === taskId) return true
      if (e.payload.id === taskId) return true
      if (e.type === 'TASK_CREATED' && e.payload.id === taskId) return true
      return false
    })
  }

  function emit(event: Omit<AgentEvent, 'id'>): AgentEvent {
    const full: AgentEvent = {
      id: makeEventId(),
      ...event,
      timestamp: event.timestamp ?? now(),
    }
    store.events.push(full)
    persist()
    return full
  }

  // ---- projects ----
  function projects(): Project[] {
    return Object.values(store.projects).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  function getProject(id: ProjectId): Project | undefined {
    return store.projects[id]
  }

  function createProject(name: string, rootPath?: string): Project {
    const id = makeId('proj')
    const t = now()
    const project: Project = { id, name, rootPath, createdAt: t, updatedAt: t }
    store.projects[id] = project
    emit({
      type: 'PROJECT_CREATED',
      projectId: id,
      sessionId: '',
      timestamp: t,
      payload: { name, rootPath },
    })
    persist()
    return project
  }

  // ---- sessions ----
  function sessions(): Session[] {
    return Object.values(store.sessions).sort((a, b) => b.startedAt - a.startedAt)
  }

  function getSession(id: SessionId): Session | undefined {
    return store.sessions[id]
  }

  function createSession(projectId: ProjectId, name: string): Session {
    const id = makeId('sess')
    const t = now()
    const session: Session = { id, projectId, name, startedAt: t }
    store.sessions[id] = session
    emit({
      type: 'SESSION_CREATED',
      projectId,
      sessionId: id,
      timestamp: t,
      payload: { name },
    })
    persist()
    return session
  }

  function endSession(sessionId: SessionId): void {
    const session = store.sessions[sessionId]
    if (!session) return
    session.endedAt = now()
    emit({
      type: 'AGENT_IDLE',
      projectId: session.projectId,
      sessionId,
      timestamp: session.endedAt,
      payload: { reason: 'session ended' },
    })
    persist()
  }

  // ---- agents ----
  function agents(): Agent[] {
    return Object.values(store.agents).sort((a, b) => b.lastActivityAt - a.lastActivityAt)
  }

  function getAgent(id: AgentId): Agent | undefined {
    return store.agents[id]
  }

  function createAgent(opts: { sessionId: SessionId; name: string; provider: Agent['provider'] }): Agent {
    const id = makeId('agent')
    const t = now()
    const session = store.sessions[opts.sessionId]
    const agent: Agent = {
      id,
      sessionId: opts.sessionId,
      name: opts.name,
      provider: opts.provider,
      status: 'active',
      startedAt: t,
      lastActivityAt: t,
      errors: [],
    }
    store.agents[id] = agent
    emit({
      type: 'AGENT_STARTED',
      projectId: session?.projectId ?? '',
      sessionId: opts.sessionId,
      agentId: id,
      timestamp: t,
      payload: { name: opts.name, provider: opts.provider },
    })
    persist()
    return agent
  }

  function setAgentStatus(agentId: AgentId, status: Agent['status']): void {
    const agent = store.agents[agentId]
    if (!agent) return
    agent.status = status
    agent.lastActivityAt = now()
    const type = status === 'completed' ? 'AGENT_COMPLETED' : status === 'idle' ? 'AGENT_IDLE' : 'AGENT_STARTED'
    emit({
      type,
      projectId: store.sessions[agent.sessionId]?.projectId ?? '',
      sessionId: agent.sessionId,
      agentId,
      timestamp: agent.lastActivityAt,
      payload: { status },
    })
    persist()
  }

  function setAgentCurrentTask(agentId: AgentId, taskId?: TaskId): void {
    const agent = store.agents[agentId]
    if (!agent) return
    agent.currentTaskId = taskId
    agent.lastActivityAt = now()
    persist()
  }

  function recordAgentError(agentId: AgentId, message: string): void {
    const agent = store.agents[agentId]
    if (!agent) return
    agent.errors.push(message)
    agent.lastActivityAt = now()
    emit({
      type: 'AGENT_ERROR',
      projectId: store.sessions[agent.sessionId]?.projectId ?? '',
      sessionId: agent.sessionId,
      agentId,
      timestamp: agent.lastActivityAt,
      payload: { message },
    })
    persist()
  }

  // ---- tasks ----
  function tasks(): Task[] {
    return Object.values(store.tasks).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  function getTask(id: TaskId): Task | undefined {
    return store.tasks[id]
  }

  function createTask(opts: {
    projectId: ProjectId
    sessionId?: SessionId
    agentId?: AgentId
    parentId?: TaskId
    title: string
    status?: TaskStatus
    priority?: Task['priority']
    dependsOn?: TaskId[]
  }): Task {
    const id = makeId('task')
    const t = now()
    const task: Task = {
      id,
      projectId: opts.projectId,
      sessionId: opts.sessionId,
      agentId: opts.agentId,
      parentId: opts.parentId,
      title: opts.title,
      status: opts.status ?? 'planned',
      priority: opts.priority ?? 'medium',
      progress: 0,
      verified: false,
      dependsOn: opts.dependsOn ?? [],
      createdAt: t,
      updatedAt: t,
    }
    store.tasks[id] = task
    emit({
      type: 'TASK_CREATED',
      projectId: opts.projectId,
      sessionId: opts.sessionId ?? '',
      agentId: opts.agentId,
      timestamp: t,
      payload: { id, title: opts.title, status: task.status, parentId: opts.parentId },
    })
    persist()
    return task
  }

  function updateTask(id: TaskId, patch: Partial<Task>): Task | undefined {
    const task = store.tasks[id]
    if (!task) return undefined
    const next = { ...task, ...patch, updatedAt: now() }
    store.tasks[id] = next
    emit({
      type: 'TASK_PROGRESS',
      projectId: next.projectId,
      sessionId: next.sessionId ?? '',
      agentId: next.agentId,
      timestamp: next.updatedAt,
      payload: { id, changes: patch },
    })
    persist()
    return next
  }

  function setTaskStatus(id: TaskId, status: TaskStatus): Task | undefined {
    const task = store.tasks[id]
    if (!task) return undefined
    task.status = status
    task.updatedAt = now()
    if (status === 'in_progress' && !task.startedAt) task.startedAt = task.updatedAt
    if (status === 'completed' || status === 'failed' || status === 'blocked')
      task.completedAt = task.updatedAt
    const typeMap: Record<TaskStatus, AgentEventType> = {
      planned: 'TASK_CREATED',
      in_progress: 'TASK_STARTED',
      completed: 'TASK_COMPLETED',
      failed: 'TASK_FAILED',
      blocked: 'TASK_BLOCKED',
      verified: 'TASK_COMPLETED',
    }
    emit({
      type: typeMap[status],
      projectId: task.projectId,
      sessionId: task.sessionId ?? '',
      agentId: task.agentId,
      timestamp: task.updatedAt,
      payload: { id, status },
    })
    persist()
    return task
  }

  function setTaskProgress(id: TaskId, progress: number): Task | undefined {
    const task = store.tasks[id]
    if (!task) return undefined
    task.progress = Math.min(100, Math.max(0, progress))
    task.updatedAt = now()
    emit({
      type: 'TASK_PROGRESS',
      projectId: task.projectId,
      sessionId: task.sessionId ?? '',
      agentId: task.agentId,
      timestamp: task.updatedAt,
      payload: { id, progress: task.progress },
    })
    persist()
    return task
  }

  function setTaskVerified(id: TaskId, verified: boolean, evidence?: string): Task | undefined {
    const task = store.tasks[id]
    if (!task) return undefined
    task.verified = verified
    task.verificationEvidence = evidence
    task.updatedAt = now()
    if (verified) task.status = 'verified'
    persist()
    return task
  }

  function addTaskDependency(taskId: TaskId, dependsOn: TaskId): void {
    const task = store.tasks[taskId]
    if (!task) return
    if (!task.dependsOn.includes(dependsOn)) task.dependsOn.push(dependsOn)
    task.updatedAt = now()
    persist()
  }

  function setTaskBlocked(taskId: TaskId, reason: string): void {
    const task = store.tasks[taskId] as Task | undefined
    if (!task) return
    task.status = 'blocked'
    task.blockedReason = reason
    task.updatedAt = now()
    emit({
      type: 'TASK_BLOCKED',
      projectId: task.projectId,
      sessionId: task.sessionId ?? '',
      agentId: task.agentId,
      timestamp: task.updatedAt,
      payload: { id: task.id, reason },
    })
    persist()
  }

  function setTaskUnblocked(taskId: TaskId): void {
    const task = store.tasks[taskId]
    if (!task) return
    task.blockedReason = undefined
    task.status = 'planned'
    task.updatedAt = now()
    emit({
      type: 'TASK_UNBLOCKED',
      projectId: task.projectId,
      sessionId: task.sessionId ?? '',
      agentId: task.agentId,
      timestamp: task.updatedAt,
      payload: { id: task.id },
    })
    persist()
  }

  // ---- subtasks ----
  function subtasks(): Subtask[] {
    return Object.values(store.subtasks).sort((a, b) => a.createdAt - b.createdAt)
  }

  function createSubtask(opts: { taskId: TaskId; title: string }): Subtask {
    const id = makeId('subtask')
    const t = now()
    const subtask: Subtask = { id, taskId: opts.taskId, title: opts.title, status: 'planned', createdAt: t }
    store.subtasks[id] = subtask
    persist()
    return subtask
  }

  function setSubtaskStatus(subtaskId: SubtaskId, status: TaskStatus): void {
    const subtask = store.subtasks[subtaskId]
    if (!subtask) return
    subtask.status = status
    if (status === 'completed') subtask.completedAt = now()
    // roll progress up to parent task as a fraction of completed subtasks
    const task = store.tasks[subtask.taskId]
    if (task) {
      const subs = Object.values(store.subtasks).filter((s) => s.taskId === subtask.taskId)
      if (subs.length > 0) {
        const done = subs.filter((s) => s.status === 'completed').length
        setTaskProgress(subtask.taskId, Math.round((done / subs.length) * 100))
      }
    }
    persist()
  }

  // ---- file changes ----
  function fileChanges(): FileChange[] {
    return [...store.fileChanges].sort((a, b) => b.timestamp - a.timestamp)
  }

  function recordFileChange(opts: {
    projectId: ProjectId
    sessionId: SessionId
    agentId?: AgentId
    taskId?: TaskId
    path: string
    action: FileChange['action']
  }): FileChange {
    const change: FileChange = {
      id: makeId('file'),
      projectId: opts.projectId,
      sessionId: opts.sessionId,
      agentId: opts.agentId,
      taskId: opts.taskId,
      path: opts.path,
      action: opts.action,
      timestamp: now(),
    }
    store.fileChanges.push(change)
    const typeMap: Record<FileChange['action'], AgentEventType> = {
      create: 'FILE_CREATED',
      modify: 'FILE_MODIFIED',
      delete: 'FILE_DELETED',
    }
    emit({
      type: typeMap[opts.action],
      projectId: opts.projectId,
      sessionId: opts.sessionId,
      agentId: opts.agentId,
      timestamp: change.timestamp,
      payload: { path: opts.path, action: opts.action, taskId: opts.taskId },
    })
    persist()
    return change
  }

  // ---- verification ----
  function verificationResults(): VerificationResult[] {
    return [...store.verificationResults].sort((a, b) => b.timestamp - a.timestamp)
  }

  function recordVerification(opts: {
    taskId: TaskId
    type: VerificationResult['type']
    status: VerificationResult['status']
    evidence: string
  }): VerificationResult {
    const result: VerificationResult = {
      id: makeId('verify'),
      taskId: opts.taskId,
      type: opts.type,
      status: opts.status,
      evidence: opts.evidence,
      timestamp: now(),
    }
    store.verificationResults.push(result)
    persist()
    return result
  }

  // ---- blockers ----
  function blockers(): Blocker[] {
    return Object.values(store.blockers).sort((a, b) => b.createdAt - a.createdAt)
  }

  function createBlocker(opts: { taskId: TaskId; reason: string }): Blocker {
    const blocker: Blocker = {
      id: makeId('blocker'),
      taskId: opts.taskId,
      reason: opts.reason,
      createdAt: now(),
    }
    store.blockers[blocker.id] = blocker
    const task = store.tasks[opts.taskId]
    if (task) setTaskBlocked(opts.taskId, opts.reason)
    persist()
    return blocker
  }

  function resolveBlocker(blockerId: string): void {
    const blocker = store.blockers[blockerId]
    if (!blocker) return
    blocker.resolvedAt = now()
    const task = store.tasks[blocker.taskId]
    if (task) setTaskUnblocked(blocker.taskId)
    persist()
  }

  // ---- overview ----
  function projectOverview(projectId: ProjectId): ProjectOverview {
    const pts = Object.values(store.tasks).filter((t) => t.projectId === projectId)
    const counts: TaskCounts = { planned: 0, inProgress: 0, completed: 0, failed: 0, blocked: 0, verified: 0 }
    for (const t of pts) {
      switch (t.status) {
        case 'planned': counts.planned++; break
        case 'in_progress': counts.inProgress++; break
        case 'completed': counts.completed++; break
        case 'failed': counts.failed++; break
        case 'blocked': counts.blocked++; break
        case 'verified': counts.verified++; break
      }
    }
    const total = pts.length
    const verifiedPercent = total > 0 ? Math.round((counts.verified / total) * 100) : 0
    const activeAgents = Object.values(store.agents).filter((a) => a.status === 'active').length

    return {
      projectId,
      totalTasks: total,
      plannedTasks: counts.planned,
      inProgressTasks: counts.inProgress,
      completedTasks: counts.completed,
      failedTasks: counts.failed,
      blockedTasks: counts.blocked,
      verifiedTasks: counts.verified,
      verifiedPercent,
      activeAgents,
    }
  }

  function save(): void {
    persist()
  }

  return {
    events,
    timeline,
    eventsForProject,
    eventsForSession,
    eventsForAgent,
    eventsForTask,
    emit,
    projects,
    getProject,
    createProject,
    sessions,
    getSession,
    createSession,
    endSession,
    agents,
    getAgent,
    createAgent,
    setAgentStatus,
    setAgentCurrentTask,
    recordAgentError,
    tasks,
    getTask,
    createTask,
    updateTask,
    setTaskStatus,
    setTaskProgress,
    setTaskVerified,
    addTaskDependency,
    setTaskBlocked,
    setTaskUnblocked,
    subtasks,
    createSubtask,
    setSubtaskStatus,
    fileChanges,
    recordFileChange,
    verificationResults,
    recordVerification,
    blockers,
    createBlocker,
    resolveBlocker,
    projectOverview,
    save,
    subscribe,
    getRevision,
  }
}

export type { TimelineFilter }
