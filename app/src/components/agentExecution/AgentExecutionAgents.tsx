/**
 * AgentExecutionAgents — Agent Monitor module.
 *
 * Shows agent identity, current assignment, current activity, execution duration,
 * files being modified, last activity, errors and dependencies per agent.
 */

import { useCallback, useEffect, useState } from 'react'
import { store } from './AgentExecutionDashboardShell'
import type { Agent } from '../../agentExecution/types'
import { useAgentExecutionRevision } from '../../agentExecution/useAgentExecutionRevision'

function durationMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export default function AgentExecutionAgents({ projectId }: { projectId?: string | null }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const revision = useAgentExecutionRevision(store)

  const refresh = useCallback(() => {
    const all = store.agents()
    setAgents(projectId ? all.filter((a) => { const s = store.getSession(a.sessionId); return s?.projectId === projectId }) : all)
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh, revision])

  return (
    <div className="agent-execution-module">
      <div className="side-bar-title">AGENT MONITOR</div>
      {agents.length === 0 ? (
        <p className="side-bar-placeholder-hint">No agents.</p>
      ) : (
        agents.map((agent) => {
          const session = store.getSession(agent.sessionId)
          const task = agent.currentTaskId ? store.getTask(agent.currentTaskId) : null
          const files = store.fileChanges().filter((f) => f.agentId === agent.id).slice(0, 5)
          return (
            <div key={agent.id} className="agent-execution-agent-card">
              <div className="agent-execution-agent-head">
                <span className={`agent-execution-agent-status-dot ${agent.status}`} aria-hidden />
                <span className="agent-execution-agent-name">{agent.name}</span>
                <span className={`agent-execution-agent-provider ${agent.provider}`}>{agent.provider}</span>
              </div>
              <div className="agent-execution-agent-body">
                <div className="agent-execution-agent-row">
                  <span className="agent-execution-agent-label">Status</span>
                  <span className="agent-execution-agent-value">{agent.status}</span>
                </div>
                <div className="agent-execution-agent-row">
                  <span className="agent-execution-agent-label">Current assignment</span>
                  <span className="agent-execution-agent-value">{task ? task.title : '—'}</span>
                </div>
                <div className="agent-execution-agent-row">
                  <span className="agent-execution-agent-label">Session</span>
                  <span className="agent-execution-agent-value">{session ? session.name.slice(0, 12) : '—'}</span>
                </div>
                <div className="agent-execution-agent-row">
                  <span className="agent-execution-agent-label">Duration</span>
                  <span className="agent-execution-agent-value">{durationMs(Date.now() - agent.startedAt)}</span>
                </div>
                <div className="agent-execution-agent-row">
                  <span className="agent-execution-agent-label">Last activity</span>
                  <span className="agent-execution-agent-value">{durationMs(Date.now() - agent.lastActivityAt)} ago</span>
                </div>
                <div className="agent-execution-agent-row">
                  <span className="agent-execution-agent-label">Files modified</span>
                  <span className="agent-execution-agent-value">{files.length}</span>
                </div>
                {agent.errors.length > 0 && (
                  <div className="agent-execution-agent-errors">
                    <div className="side-bar-title" style={{ fontSize: 11, marginBottom: 4 }}>Errors</div>
                    {agent.errors.map((e, i) => (
                      <div key={i} className="agent-execution-agent-error">{e}</div>
                    ))}
                  </div>
                )}
              </div>
              {files.length > 0 && (
                <div className="agent-execution-agent-files">
                  <div className="side-bar-title" style={{ fontSize: 11, marginBottom: 4 }}>Recent files</div>
                  <ul className="agent-execution-agent-file-list">
                    {files.map((f) => (
                      <li key={f.id} className="agent-execution-agent-file-row">
                        <span className={`codicon codicon-${f.action === 'create' ? 'file' : f.action === 'delete' ? 'trashcan' : 'edit'}`} aria-hidden />
                        {f.path}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
