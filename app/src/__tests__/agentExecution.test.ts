/**
 * Unit tests for the Agent Execution Tracking Engine.
 */
import { describe, it, expect } from 'vitest'
import { createEventStore, type AgentExecutionStore } from '../agentExecution/eventStore'

function freshStore(): ReturnType<typeof createEventStore> {
  return createEventStore({
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
  })
}

describe('event store: projects and sessions', () => {
  it('creates a project and emits PROJECT_CREATED', () => {
    const store = freshStore()
    const proj = store.createProject('Demo', '/root/demo')
    expect(proj.name).toBe('Demo')
    expect(proj.rootPath).toBe('/root/demo')
    expect(store.projects()).toHaveLength(1)
    const evts = store.eventsForProject(proj.id)
    expect(evts.some((e) => e.type === 'PROJECT_CREATED')).toBe(true)
  })

  it('creates a session and emits SESSION_CREATED', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 'session-1')
    expect(sess.projectId).toBe(proj.id)
    expect(store.sessions()).toHaveLength(1)
    expect(store.eventsForSession(sess.id).some((e) => e.type === 'SESSION_CREATED')).toBe(true)
  })

  it('endSession sets endedAt and emits AGENT_IDLE', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    store.endSession(sess.id)
    const ended = store.getSession(sess.id)
    expect(ended?.endedAt).toBeDefined()
    expect(store.eventsForSession(sess.id).some((e) => e.type === 'AGENT_IDLE')).toBe(true)
  })
})

describe('event store: agents', () => {
  it('creates an agent and emits AGENT_STARTED', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const agent = store.createAgent({ sessionId: sess.id, name: 'claude', provider: 'claude-code' })
    expect(agent.status).toBe('active')
    expect(store.eventsForAgent(agent.id).some((e) => e.type === 'AGENT_STARTED')).toBe(true)
  })

  it('records an agent error', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const agent = store.createAgent({ sessionId: sess.id, name: 'a', provider: 'custom' })
    store.recordAgentError(agent.id, 'boom')
    expect(store.getAgent(agent.id)?.errors).toContain('boom')
    expect(store.eventsForAgent(agent.id).some((e) => e.type === 'AGENT_ERROR')).toBe(true)
  })

  it('tracks current task and last activity', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const agent = store.createAgent({ sessionId: sess.id, name: 'a', provider: 'custom' })
    store.setAgentCurrentTask(agent.id, 'task-1')
    expect(store.getAgent(agent.id)?.currentTaskId).toBe('task-1')
  })
})

describe('event store: tasks and status rollups', () => {
  it('creates tasks with planned status', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const t = store.createTask({ projectId: proj.id, title: 'Task A', status: 'planned' })
    expect(t.status).toBe('planned')
    expect(t.progress).toBe(0)
    expect(t.verified).toBe(false)
    expect(store.eventsForTask(t.id).some((e) => e.type === 'TASK_CREATED')).toBe(true)
  })

  it('moves a task from planned to in_progress to completed', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const t = store.createTask({ projectId: proj.id, title: 'Task A' })
    expect(store.setTaskStatus(t.id, 'in_progress')?.status).toBe('in_progress')
    expect(store.getTask(t.id)?.startedAt).toBeDefined()
    expect(store.eventsForTask(t.id).some((e) => e.type === 'TASK_STARTED')).toBe(true)
    expect(store.setTaskStatus(t.id, 'completed')?.status).toBe('completed')
    expect(store.getTask(t.id)?.completedAt).toBeDefined()
  })

  it('blocks and unblocks a task with a reason', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const t = store.createTask({ projectId: proj.id, title: 'Task A' })
    store.setTaskBlocked(t.id, 'waiting on API')
    expect(store.getTask(t.id)?.status).toBe('blocked')
    expect(store.getTask(t.id)?.blockedReason).toBe('waiting on API')
    store.setTaskUnblocked(t.id)
    expect(store.getTask(t.id)?.status).toBe('planned')
    expect(store.getTask(t.id)?.blockedReason).toBeUndefined()
  })

  it('verification is separate from completion', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const t = store.createTask({ projectId: proj.id, title: 'Task A' })
    store.setTaskStatus(t.id, 'completed')
    expect(store.getTask(t.id)?.verified).toBe(false)
    store.setTaskVerified(t.id, true, 'pytest passed')
    expect(store.getTask(t.id)?.verified).toBe(true)
    expect(store.getTask(t.id)?.status).toBe('verified')
  })

  it('derived progress from subtasks', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const t = store.createTask({ projectId: proj.id, title: 'Task A' })
    const s1 = store.createSubtask({ taskId: t.id, title: 'sub 1' })
    const s2 = store.createSubtask({ taskId: t.id, title: 'sub 2' })
    store.setSubtaskStatus(s1.id, 'completed')
    expect(store.getTask(t.id)?.progress).toBe(50)
    store.setSubtaskStatus(s2.id, 'completed')
    expect(store.getTask(t.id)?.progress).toBe(100)
  })

  it('computes project overview counts and verified %', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    store.createTask({ projectId: proj.id, title: 'A', status: 'planned' })
    store.createTask({ projectId: proj.id, title: 'B', status: 'in_progress' })
    store.createTask({ projectId: proj.id, title: 'C', status: 'completed' })
    store.createTask({ projectId: proj.id, title: 'D', status: 'failed' })
    store.createTask({ projectId: proj.id, title: 'E', status: 'blocked' })
    store.createTask({ projectId: proj.id, title: 'F', status: 'verified' })
    store.setAgentStatus(
      store.createAgent({ sessionId: store.createSession(proj.id, 's').id, name: 'x', provider: 'custom' }).id,
      'active',
    )
    const ov = store.projectOverview(proj.id)
    expect(ov.totalTasks).toBe(6)
    expect(ov.plannedTasks).toBe(1)
    expect(ov.inProgressTasks).toBe(1)
    expect(ov.completedTasks).toBe(1)
    expect(ov.failedTasks).toBe(1)
    expect(ov.blockedTasks).toBe(1)
    expect(ov.verifiedTasks).toBe(1)
    expect(ov.verifiedPercent).toBe(Math.round((1 / 6) * 100))
    expect(ov.activeAgents).toBe(1)
  })

  it('empty project has 0 verified percent', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    expect(store.projectOverview(proj.id).verifiedPercent).toBe(0)
  })
})

describe('event store: dependencies', () => {
  it('tracks task dependencies', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const parent = store.createTask({ projectId: proj.id, title: 'parent' })
    const child = store.createTask({ projectId: proj.id, title: 'child' })
    store.addTaskDependency(child.id, parent.id)
    expect(store.getTask(child.id)?.dependsOn).toContain(parent.id)
  })
})

describe('event store: file changes', () => {
  it('records file creates/modifies/deletes and emits events', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const fc = store.recordFileChange({
      projectId: proj.id,
      sessionId: sess.id,
      path: 'src/a.ts',
      action: 'create',
    })
    expect(fc.action).toBe('create')
    expect(store.fileChanges()).toHaveLength(1)
    expect(store.eventsForProject(proj.id).some((e) => e.type === 'FILE_CREATED')).toBe(true)
    store.recordFileChange({ projectId: proj.id, sessionId: sess.id, path: 'src/a.ts', action: 'modify' })
    store.recordFileChange({ projectId: proj.id, sessionId: sess.id, path: 'src/b.ts', action: 'delete' })
    const actions = store.fileChanges().map((c) => c.action).sort()
    expect(actions).toEqual(['create', 'delete', 'modify'])
  })
})

describe('event store: verification results', () => {
  it('records build and test verification separately', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const t = store.createTask({ projectId: proj.id, title: 'Task A' })
    store.recordVerification({
      taskId: t.id,
      type: 'build',
      status: 'passed',
      evidence: 'tsc --noEmit clean',
    })
    store.recordVerification({
      taskId: t.id,
      type: 'unit-test',
      status: 'failed',
      evidence: '2 tests failed',
    })
    const vs = store.verificationResults()
    expect(vs).toHaveLength(2)
    expect(vs.find((v) => v.type === 'unit-test')?.status).toBe('failed')
  })
})

describe('event store: blockers', () => {
  it('creates and resolves a blocker', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const t = store.createTask({ projectId: proj.id, title: 'Task A' })
    const blocker = store.createBlocker({ taskId: t.id, reason: 'network' })
    expect(blocker.taskId).toBe(t.id)
    expect(store.getTask(t.id)?.status).toBe('blocked')
    store.resolveBlocker(blocker.id)
    expect(store.getTask(t.id)?.blockedReason).toBeUndefined()
  })
})

describe('event store: timeline filter', () => {
  it('filters by type and agent', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const agent = store.createAgent({ sessionId: sess.id, name: 'a', provider: 'custom' })
    store.createTask({ projectId: proj.id, sessionId: sess.id, agentId: agent.id, title: 'T' })
    const tl = store.timeline({ projectId: proj.id, types: ['TASK_CREATED'] })
    expect(tl.length).toBe(1)
    expect(tl[0].type).toBe('TASK_CREATED')
  })
})

describe('event store: persistence round-trip', () => {
  it('loadStore returns what was saved', () => {
    const store = freshStore()
    const proj = store.createProject('Demo', '/root/demo')
    store.createSession(proj.id, 's1')
    store.save()
    const loaded = createEventStore(loadStoreSnapshot())
    const p = loaded.projects()[0]
    expect(p.name).toBe('Demo')
    expect(p.rootPath).toBe('/root/demo')
    expect(loaded.sessions()).toHaveLength(1)
  })
})

function loadStoreSnapshot(): AgentExecutionStore {
  if (typeof localStorage === 'undefined') return { version: 1, projects: {}, sessions: {}, agents: {}, tasks: {}, subtasks: {}, events: [], fileChanges: [], verificationResults: [], blockers: {} }
  const raw = localStorage.getItem('objectiv-agent-execution-v1')
  return JSON.parse(raw || '{}') as AgentExecutionStore
}
