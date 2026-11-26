/**
 * AgentExecutionTimeline — Execution Timeline module.
 *
 * Chronological event stream with agent activity, task transitions, tool
 * executions, test results and failures/recovery events. Filterable by type,
 * agent, task and session.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { store } from './AgentExecutionDashboardShell'
import type { AgentEvent, AgentEventType } from '../../agentExecution/types'
import { useAgentExecutionRevision } from '../../agentExecution/useAgentExecutionRevision'

function eventIcon(type: AgentEventType): string {
  const map: Record<AgentEventType, string> = {
    PROJECT_CREATED: 'project',
    SESSION_CREATED: 'account',
    PLAN_CREATED: 'list-ordered',
    PLAN_UPDATED: 'list-ordered',
    TASK_CREATED: 'add',
    TASK_ASSIGNED: 'person',
    TASK_STARTED: 'play',
    TASK_PROGRESS: 'sync~spin',
    TASK_COMPLETED: 'check',
    TASK_FAILED: 'error',
    TASK_BLOCKED: 'stop',
    TASK_UNBLOCKED: 'circle-slash',
    FILE_CREATED: 'file',
    FILE_MODIFIED: 'edit',
    FILE_DELETED: 'trashcan',
    TEST_STARTED: 'beaker',
    TEST_PASSED: 'pass',
    TEST_FAILED: 'test-fail',
    BUILD_STARTED: 'tools',
    BUILD_PASSED: 'check',
    BUILD_FAILED: 'error',
    AGENT_STARTED: 'robot',
    AGENT_IDLE: 'circle-outline',
    AGENT_COMPLETED: 'check',
    AGENT_ERROR: 'error',
  }
  return map[type] ?? 'circle-outline'
}

export default function AgentExecutionTimeline({ projectId }: { projectId?: string | null }) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [filter, setFilter] = useState<AgentEventType | 'all'>('all')
  const revision = useAgentExecutionRevision(store)

  const refresh = useCallback(() => {
    const tl = store.timeline({ projectId: projectId ?? '', types: [] })
    setEvents(tl)
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh, revision])

  const visible = filter === 'all' ? events : events.filter((e) => e.type === filter)

  const types = useMemo(() => {
    const set = new Set<AgentEventType>()
    for (const e of events) set.add(e.type)
    return [...set].sort()
  }, [events])

  return (
    <div className="agent-execution-module">
      <div className="side-bar-title">EXECUTION TIMELINE</div>
      <div className="agent-execution-timeline-toolbar">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            className={`agent-execution-type-pill ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(filter === t ? 'all' : t)}
          >
            <span className={`codicon codicon-${eventIcon(t)}`} aria-hidden />
            {t} <span className="agent-execution-pill-count">{events.filter((e) => e.type === t).length}</span>
          </button>
        ))}
        <button type="button" className="agent-execution-type-pill" onClick={() => setFilter('all')}>All</button>
      </div>
      <div className="agent-execution-timeline-list">
        {visible.length === 0 ? (
          <p className="side-bar-placeholder-hint">No events.</p>
        ) : (
          visible.map((e) => (
            <div key={e.id} className="agent-execution-event-row">
              <span className={`codicon codicon-${eventIcon(e.type)} agent-execution-event-icon`} aria-hidden />
              <div className="agent-execution-event-info">
                <div className="agent-execution-event-type">{e.type}</div>
                <div className="agent-execution-event-meta">
                  {e.agentId && <span>agent {e.agentId.slice(0, 8)}</span>}
                  {typeof e.payload.taskId === 'string' && (
                    <span>task {e.payload.taskId.slice(0, 8)}</span>
                  )}
                  {new Date(e.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
