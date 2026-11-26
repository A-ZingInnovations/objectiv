import { describe, it, expect, afterEach } from 'vitest'
import { createEventStore } from '../agentExecution/eventStore'
import {
  startAgentExecutionAdapters,
  stopAgentExecutionAdapters,
  agentExecutionHookStatus,
} from '../agentExecution/runtime'

describe('agent execution runtime', () => {
  afterEach(() => stopAgentExecutionAdapters())

  it('registers Cursor hook when adapters start', () => {
    const store = createEventStore({
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
    const projectId = store.createProject('p').id
    startAgentExecutionAdapters(store, projectId, 'cursor')
    expect(store.agents().some((a) => a.provider === 'cursor')).toBe(true)
    const status = agentExecutionHookStatus()
    if (typeof window !== 'undefined') {
      expect(status.cursor).toBe(true)
    }
  })
})