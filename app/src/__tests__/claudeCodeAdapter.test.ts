/**
 * Unit tests for the Claude Code adapter.
 */
import { describe, it, expect } from 'vitest'
import { createEventStore } from '../agentExecution/eventStore'
import { ClaudeCodeAdapter } from '../agentExecution/adapters/claudeCode'
import type { ClaudeCodeHookEvent } from '../agentExecution/adapters/claudeCode'

function freshStore() {
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

function hook(): (e: ClaudeCodeHookEvent) => void {
  return (window as unknown as { __objectivClaudeCode?: (e: ClaudeCodeHookEvent) => void }).__objectivClaudeCode!
}

describe('ClaudeCodeAdapter', () => {
  it('starts connected and emits AGENT_STARTED', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const adapter = new ClaudeCodeAdapter()
    const stop = adapter.start({ store, sessionId: sess.id, projectId: proj.id })
    expect(adapter.connected).toBe(true)
    const agent = store.agents()[0]
    expect(agent.name).toBe('Claude Code')
    expect(store.eventsForAgent(agent.id).some((e) => e.type === 'AGENT_STARTED')).toBe(true)
    stop()
    expect(adapter.connected).toBe(false)
  })

  it('translates SessionStart to SESSION_CREATED', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const adapter = new ClaudeCodeAdapter()
    adapter.start({ store, sessionId: sess.id, projectId: proj.id })
    const agent = store.agents()[0]
    hook()({ type: 'SessionStart', sessionId: sess.id, cwd: '/root/demo' })
    expect(
      store.eventsForAgent(agent.id).some((e) => e.type === 'SESSION_CREATED' && e.payload.cwd === '/root/demo'),
    ).toBe(true)
  })

  it('translates UserPromptSubmit to TASK_PROGRESS', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const adapter = new ClaudeCodeAdapter()
    adapter.start({ store, sessionId: sess.id, projectId: proj.id })
    const agent = store.agents()[0]
    hook()({ type: 'UserPromptSubmit', prompt: 'add a button', sessionId: sess.id })
    expect(
      store.eventsForAgent(agent.id).some(
        (e) => e.type === 'TASK_PROGRESS' && e.payload.kind === 'user-prompt' && e.payload.prompt === 'add a button',
      ),
    ).toBe(true)
  })

  it('translates PostToolUse Write to FILE_CREATED', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const adapter = new ClaudeCodeAdapter()
    adapter.start({ store, sessionId: sess.id, projectId: proj.id })
    const agent = store.agents()[0]
    hook()({
      type: 'PostToolUse',
      tool: 'Write',
      input: { path: 'src/a.ts' },
      output: null,
      sessionId: sess.id,
    })
    expect(store.fileChanges().some((f) => f.path === 'src/a.ts' && f.action === 'create')).toBe(true)
    expect(store.eventsForAgent(agent.id).some((e) => e.type === 'FILE_CREATED')).toBe(true)
  })

  it('records agent error on Notification', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const adapter = new ClaudeCodeAdapter()
    adapter.start({ store, sessionId: sess.id, projectId: proj.id })
    const agent = store.agents()[0]
    hook()({ type: 'Notification', message: 'boom', sessionId: sess.id })
    expect(store.getAgent(agent.id)?.errors).toContain('boom')
    expect(store.eventsForAgent(agent.id).some((e) => e.type === 'AGENT_ERROR')).toBe(true)
  })

  it('Stop sets agent idle/completed', () => {
    const store = freshStore()
    const proj = store.createProject('Demo')
    const sess = store.createSession(proj.id, 's1')
    const adapter = new ClaudeCodeAdapter()
    adapter.start({ store, sessionId: sess.id, projectId: proj.id })
    const agent = store.agents()[0]
    hook()({ type: 'Stop', sessionId: sess.id, outcome: 'completed' })
    expect(store.getAgent(agent.id)?.status).toBe('completed')
    expect(store.eventsForAgent(agent.id).some((e) => e.type === 'AGENT_COMPLETED')).toBe(true)
  })
})
