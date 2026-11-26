/**
 * End-to-end demonstration: a full agent execution monitored through the
 * Claude Code adapter, from planning to verification, with history surviving a
 * simulated restart (store reload).
 */
import { describe, it, expect } from 'vitest'
import { createEventStore, loadStore } from '../agentExecution/eventStore'
import { ClaudeCodeAdapter } from '../agentExecution/adapters/claudeCode'

function hook(): (e: unknown) => void {
  return (window as unknown as { __objectivClaudeCode?: (e: unknown) => void }).__objectivClaudeCode!
}

describe('agent execution dashboard: end-to-end', () => {
  it('monitors a full execution and persists history across restart', () => {
    const store = createEventStore(loadStore())
    const proj = store.createProject('Demo Feature', '/root/demo')
    const sess = store.createSession(proj.id, 'feature-1')

    const adapter = new ClaudeCodeAdapter()
    adapter.start({ store, sessionId: sess.id, projectId: proj.id })
    const agent = store.agents().find((a) => a.sessionId === sess.id)!

    // Plan created
    store.emit({
      type: 'PLAN_CREATED',
      projectId: proj.id,
      sessionId: sess.id,
      agentId: agent.id,
      payload: { plan: 'add login form' },
    })

    // Tasks created
    const taskUi = store.createTask({
      projectId: proj.id,
      sessionId: sess.id,
      agentId: agent.id,
      title: 'Build login UI',
      status: 'planned',
      priority: 'high',
    })
    const taskApi = store.createTask({
      projectId: proj.id,
      sessionId: sess.id,
      agentId: agent.id,
      title: 'Wire login API',
      status: 'planned',
      priority: 'high',
    })
    store.addTaskDependency(taskApi.id, taskUi.id)

    // Agent starts UI task, invokes Write tool (observed file change)
    store.setAgentCurrentTask(agent.id, taskUi.id)
    store.setTaskStatus(taskUi.id, 'in_progress')
    hook()({
      type: 'PostToolUse',
      tool: 'Write',
      input: { path: 'src/Login.tsx' },
      output: null,
      sessionId: sess.id,
    })

    // Build + tests run and pass (evidence-backed verification)
    store.recordVerification({
      taskId: taskUi.id,
      type: 'build',
      status: 'passed',
      evidence: 'tsc --noEmit clean',
    })
    store.recordVerification({
      taskId: taskUi.id,
      type: 'unit-test',
      status: 'passed',
      evidence: 'Login.test.tsx: 4 passed, 0 failed',
    })

    // Task completed and verified (verification is separate from completion)
    store.setTaskStatus(taskUi.id, 'completed')
    store.setTaskVerified(taskUi.id, true, 'build + unit tests passed')

    // Agent finishes
    hook()({ type: 'Stop', sessionId: sess.id, outcome: 'completed' })

    // ---- Assertions on live state ----
    const ov = store.projectOverview(proj.id)
    expect(ov.totalTasks).toBe(2)
    expect(ov.completedTasks).toBe(0) // promoted to 'verified' (completed ≠ verified)
    expect(ov.verifiedTasks).toBe(1)
    expect(ov.verifiedPercent).toBe(50)
    expect(ov.activeAgents).toBe(0)

    const ui = store.getTask(taskUi.id)
    expect(ui?.status).toBe('verified') // verification promotes completed → verified
    expect(ui?.verified).toBe(true)
    expect(ui?.verificationEvidence).toBe('build + unit tests passed')

    // Planned != in-progress != completed != verified
    expect(store.getTask(taskApi.id)?.status).toBe('planned')
    expect(store.getTask(taskApi.id)?.verified).toBe(false)

    // File change associated with agent + task
    const fc = store.fileChanges().find((f) => f.path === 'src/Login.tsx')
    expect(fc).toBeDefined()
    expect(fc!.agentId).toBe(agent.id)
    expect(fc!.taskId).toBe(taskUi.id)

    // Full history preserved (append-only)
    const events = store.eventsForProject(proj.id)
    expect(events.some((e) => e.type === 'FILE_CREATED')).toBe(true)
    expect(events.some((e) => e.type === 'TASK_COMPLETED')).toBe(true)
    expect(events.some((e) => e.type === 'AGENT_COMPLETED')).toBe(true)

    // ---- Simulated restart: reload from localStorage ----
    store.save()
    const reloaded = createEventStore(loadStore())
    const ov2 = reloaded.projectOverview(proj.id)
    expect(ov2.totalTasks).toBe(2)
    expect(ov2.verifiedTasks).toBe(1)
    expect(ov2.verifiedPercent).toBe(50)
    const ui2 = reloaded.getTask(taskUi.id)
    expect(ui2?.status).toBe('verified')
    expect(ui2?.verified).toBe(true)
    const fc2 = reloaded.fileChanges().find((f) => f.path === 'src/Login.tsx')
    expect(fc2).toBeDefined()
    const hist2 = reloaded.eventsForProject(proj.id)
    expect(hist2.some((e) => e.type === 'FILE_CREATED')).toBe(true)
  })
})
