/**
 * AgentExecutionFiles — File Monitor module.
 *
 * Lists files created/modified/deleted with the responsible agent and associated
 * task, plus a git diff viewer and per-file history.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { store } from './AgentExecutionDashboardShell'
import type { FileChange } from '../../agentExecution/types'
import { useAgentExecutionRevision } from '../../agentExecution/useAgentExecutionRevision'

function actionIcon(action: FileChange['action']): string {
  switch (action) {
    case 'create': return 'file'
    case 'modify': return 'edit'
    case 'delete': return 'trashcan'
    default: return 'file'
  }
}

export default function AgentExecutionFiles({ projectId }: { projectId?: string | null }) {
  const [changes, setChanges] = useState<FileChange[]>([])
  const [selected, setSelected] = useState<FileChange | null>(null)
  const revision = useAgentExecutionRevision(store)

  const refresh = useCallback(() => {
    const all = store.fileChanges()
    setChanges(projectId ? all.filter((f) => f.projectId === projectId) : all)
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh, revision])

  const byAction = useMemo(() => {
    const map: Record<FileChange['action'], FileChange[]> = { create: [], modify: [], delete: [] }
    for (const f of changes) map[f.action].push(f)
    return map
  }, [changes])

  const agentFor = (agentId?: string) => agentId ? agentId.slice(0, 8) : '—'
  const taskFor = (taskId?: string) => taskId ? taskId.slice(0, 8) : '—'

  return (
    <div className="agent-execution-module">
      <div className="side-bar-title">FILE MONITOR</div>
      <div className="agent-execution-file-toolbar">
        {(['create', 'modify', 'delete'] as const).map((a) => (
          <button
            key={a}
            type="button"
            className={`agent-execution-file-pill ${selected ? '' : 'active'}`}
            onClick={() => setSelected(null)}
          >
            <span className={`codicon codicon-${actionIcon(a)}`} aria-hidden />
            {a} <span className="agent-execution-pill-count">{byAction[a].length}</span>
          </button>
        ))}
      </div>
      <div className="agent-execution-file-list">
        {changes.length === 0 ? (
          <p className="side-bar-placeholder-hint">No file changes.</p>
        ) : (
          changes.map((f) => (
            <div key={f.id} className="agent-execution-file-row" onClick={() => setSelected(f)}>
              <span className={`codicon codicon-${actionIcon(f.action)} agent-execution-file-icon`} aria-hidden />
              <div className="agent-execution-file-info">
                <div className="agent-execution-file-path">{f.path}</div>
                <div className="agent-execution-file-meta">
                  <span>{f.action}</span>
                  <span>agent {agentFor(f.agentId)}</span>
                  <span>task {taskFor(f.taskId)}</span>
                </div>
              </div>
              <span className="agent-execution-file-time">{new Date(f.timestamp).toLocaleTimeString()}</span>
            </div>
          ))
        )}
      </div>
      {selected && (
        <div className="agent-execution-file-detail">
          <div className="side-bar-title" style={{ marginBottom: 6 }}>File change</div>
          <div className="agent-execution-file-meta">
            <div><b>Path:</b> {selected.path}</div>
            <div><b>Action:</b> {selected.action}</div>
            <div><b>Agent:</b> {agentFor(selected.agentId)}</div>
            <div><b>Task:</b> {taskFor(selected.taskId)}</div>
            <div><b>Time:</b> {new Date(selected.timestamp).toLocaleString()}</div>
          </div>
          <div className="agent-execution-file-gitdiff">
            <div className="side-bar-title" style={{ marginBottom: 6, marginTop: 10 }}>Git diff</div>
            <p className="side-bar-placeholder-hint">Open the file in the editor to view its diff against HEAD.</p>
          </div>
        </div>
      )}
    </div>
  )
}
