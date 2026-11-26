import { describe, it, expect } from 'vitest'
import bundledStatusMd from '../../../IMPLEMENTATION_STATUS.md?raw'
import {
  parseImplementationStatusMarkdown,
  ensureImplementationPlanSeeded,
} from '../agentExecution/implementationPlanSeed'
import { createEventStore } from '../agentExecution/eventStore'

describe('implementation plan seed', () => {
  it('parses IMPLEMENTATION_STATUS.md milestones', () => {
    const milestones = parseImplementationStatusMarkdown(bundledStatusMd)
    expect(milestones.length).toBe(10)
    expect(milestones[0].title).toContain('Tracking engine')
  })

  it('seeds milestone tasks into the event store', async () => {
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
    const projectId = store.createProject('Objectiv').id
    const created = await ensureImplementationPlanSeeded(store, projectId, null)
    expect(created).toBe(10)
    expect(store.tasks().length).toBe(10)
    expect(store.projectOverview(projectId).verifiedTasks).toBe(10)
  })
})