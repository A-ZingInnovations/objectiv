/**
 * AgentExecutionTasks — Task Management module.
 *
 * Kanban board grouped by status, task hierarchy (parent/children), dependencies,
 * priority, assigned agent, actual status, verification status and per-task history.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { store } from './AgentExecutionDashboardShell'
import type { Task, TaskStatus } from '../../agentExecution/types'
import { useAgentExecutionRevision } from '../../agentExecution/useAgentExecutionRevision'

type KanbanStatus = 'planned' | 'in_progress' | 'completed' | 'failed' | 'blocked' | 'verified'

const KANBAN_STATUSES: KanbanStatus[] = ['planned', 'in_progress', 'completed', 'failed', 'blocked', 'verified']

function taskIcon(status: TaskStatus): string {
  switch (status) {
    case 'planned': return 'circle-outline'
    case 'in_progress': return 'sync~spin'
    case 'completed': return 'check'
    case 'failed': return 'error'
    case 'blocked': return 'stop'
    case 'verified': return 'pass'
    default: return 'circle-outline'
  }
}

export default function AgentExecutionTasks({ projectId }: { projectId?: string | null }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<KanbanStatus | 'all'>('all')
  const revision = useAgentExecutionRevision(store)

  const refresh = useCallback(() => {
    if (!projectId) { setTasks([]); return }
    const all = store.tasks().filter((t) => t.projectId === projectId)
    setTasks(all)
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh, revision])

  const byStatus = useMemo(() => {
    const map: Record<KanbanStatus, Task[]> = { planned: [], in_progress: [], completed: [], failed: [], blocked: [], verified: [] }
    for (const t of tasks) {
      if (t.status in map) map[t.status].push(t)
    }
    for (const s of KANBAN_STATUSES) {
      map[s].sort((a: Task, b: Task) =>
        (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0) || b.updatedAt - a.updatedAt,
      )
    }
    return map
  }, [tasks])

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)

  return (
    <div className="agent-execution-module">
      <div className="side-bar-title">TASK MANAGEMENT</div>
      <div className="agent-execution-task-toolbar">
        {KANBAN_STATUSES.map((s) => {
          const count = byStatus[s].length
          return (
            <button
              key={s}
              type="button"
              className={`agent-execution-status-pill ${filter === s ? 'active' : ''} ${s === 'in_progress' || s === 'blocked' || s === 'failed' ? 'alert' : ''}`}
              onClick={() => setFilter(filter === s ? 'all' : s)}
            >
              <span className={`codicon codicon-${taskIcon(s)}`} aria-hidden />
              {s.replace('_', ' ')} <span className="agent-execution-pill-count">{count}</span>
            </button>
          )
        })}
        <button type="button" className="agent-execution-status-pill" onClick={() => setFilter('all')}>All</button>
      </div>
      <div className="agent-execution-kanban">
        {KANBAN_STATUSES.map((s) => (
          <div key={s} className="agent-execution-kanban-column">
            <div className="agent-execution-kanban-column-head">
              <span className={`codicon codicon-${taskIcon(s)}`} aria-hidden />
              {s.replace('_', ' ')} <span className="agent-execution-kanban-count">{byStatus[s].length}</span>
            </div>
            <div className="agent-execution-kanban-column-body">
              {byStatus[s].length === 0 ? (
                <p className="side-bar-placeholder-hint">None</p>
              ) : (
                byStatus[s].map((t) => (
                  <div key={t.id} className="agent-execution-task-card">
                    <div className="agent-execution-task-card-head">
                      <span className={`agent-execution-task-priority agent-execution-priority-${t.priority}`} title={`Priority: ${t.priority}`}>
                        {t.priority === 'high' ? '!' : t.priority === 'medium' ? '–' : '—'}
                      </span>
                      <span className={`agent-execution-task-status codicon codicon-${taskIcon(t.status)}`} aria-hidden />
                    </div>
                    <div className="agent-execution-task-card-title">{t.title}</div>
                    <div className="agent-execution-task-card-meta">
                      {t.agentId && <span className="agent-execution-task-agent">{t.agentId.slice(0, 8)}</span>}
                      {t.dependsOn.length > 0 && <span className="agent-execution-task-deps">depends: {t.dependsOn.length}</span>}
                      {t.blockedReason && <span className="agent-execution-task-blocked">blocked: {t.blockedReason}</span>}
                    </div>
                    <div className="agent-execution-task-card-foot">
                      <span>progress {t.progress}%</span>
                      <span>{t.verified ? 'verified' : 'unverified'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="agent-execution-task-list">
        <div className="side-bar-title" style={{ marginTop: 12, marginBottom: 6 }}>Task history</div>
        <ul className="agent-execution-task-history">
          {visible.length === 0 ? (
            <li className="side-bar-placeholder-hint">No tasks.</li>
          ) : (
            visible.slice(0, 12).map((t) => (
              <li key={t.id} className="agent-execution-task-history-row">
                <span className="agent-execution-task-history-id">{t.id.slice(0, 8)}</span>
                <span className="agent-execution-task-history-title">{t.title}</span>
                <span className={`agent-execution-task-history-status codicon codicon-${taskIcon(t.status)}`} title={t.status} aria-hidden />
                {t.blockedReason && <span className="agent-execution-task-history-blocked">blocked: {t.blockedReason}</span>}
              </li>
            ))
          )}
        </ul>
        {visible.length > 12 && <p className="side-bar-placeholder-hint">Showing 12 of {visible.length} tasks.</p>}
      </div>
    </div>
  )
}
