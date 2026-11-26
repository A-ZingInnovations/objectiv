/**
 * AgentExecutionOverview — Project Overview module.
 *
 * Displays total/planned/in-progress/completed/failed/blocked task counts,
 * active agents, and verified completion percentage derived from real task
 * state (never fabricated estimates).
 */

import { useCallback, useEffect, useState } from 'react'
import { store } from './AgentExecutionDashboardShell'
import type { ProjectOverview, Task } from '../../agentExecution/types'
import { useAgentExecutionRevision } from '../../agentExecution/useAgentExecutionRevision'

export default function AgentExecutionOverview({ projectId }: { projectId?: string | null }) {
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [planTasks, setPlanTasks] = useState<Task[]>([])
  const revision = useAgentExecutionRevision(store)

  const refresh = useCallback(() => {
    if (!projectId) {
      setOverview(null)
      setPlanTasks([])
      return
    }
    setOverview(store.projectOverview(projectId))
    const milestones = store
      .tasks()
      .filter((t) => t.projectId === projectId && t.title.startsWith('Milestone '))
      .sort((a, b) => {
        const na = Number(a.title.match(/^Milestone\s+(\d+)/)?.[1] ?? 0)
        const nb = Number(b.title.match(/^Milestone\s+(\d+)/)?.[1] ?? 0)
        return na - nb
      })
    setPlanTasks(milestones)
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh, revision])

  const stat = (label: string, value: number | null, accent = '') => (
    <div key={label} className="agent-execution-stat">
      <div className="agent-execution-stat-value" style={accent ? { color: accent } : {}}>
        {value === null ? '—' : value}
      </div>
      <div className="agent-execution-stat-label">{label}</div>
    </div>
  )

  if (!overview) {
    return (
      <div className="agent-execution-module">
        <div className="side-bar-title">PROJECT OVERVIEW</div>
        <p className="side-bar-placeholder-hint">No project selected.</p>
      </div>
    )
  }

  return (
    <div className="agent-execution-module">
      <div className="side-bar-title">PROJECT OVERVIEW</div>
      <div className="agent-execution-stats">
        {stat('Total tasks', overview.totalTasks)}
        {stat('Planned', overview.plannedTasks)}
        {stat('In progress', overview.inProgressTasks, '#38bdf8')}
        {stat('Completed', overview.completedTasks, '#4ade80')}
        {stat('Failed', overview.failedTasks, '#f48771')}
        {stat('Blocked', overview.blockedTasks, '#fb923c')}
        {stat('Verified', overview.verifiedTasks, '#a78bfa')}
        {stat('Active agents', overview.activeAgents)}
      </div>
      <div className="agent-execution-verified">
        <div className="agent-execution-verified-head">
          <span>Verified completion</span>
          <span className="agent-execution-verified-value">{overview.verifiedPercent}%</span>
        </div>
        <div className="agent-execution-verified-bar" role="progressbar" aria-valuenow={overview.verifiedPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Verified completion">
          <div className="agent-execution-verified-fill" style={{ width: `${overview.verifiedPercent}%` }} />
        </div>
        <p className="agent-execution-verified-hint">
          Verified tasks ÷ total tasks. Verification requires evidence from configured checks —
          agent-reported success alone does not count.
        </p>
      </div>
      {planTasks.length > 0 && (
        <div className="agent-execution-plan-list">
          <div className="side-bar-title" style={{ marginTop: 14 }}>
            IMPLEMENTATION PLAN
          </div>
          <ul className="agent-execution-plan-milestones">
            {planTasks.map((t) => (
              <li key={t.id} className="agent-execution-plan-row">
                <span className="agent-execution-plan-title">{t.title}</span>
                <span className="agent-execution-plan-status">
                  {t.verificationEvidence?.startsWith('Plan:')
                    ? t.verificationEvidence.split('·')[0].replace('Plan:', '').trim()
                    : t.status}
                </span>
                <span className="agent-execution-plan-track">{t.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
