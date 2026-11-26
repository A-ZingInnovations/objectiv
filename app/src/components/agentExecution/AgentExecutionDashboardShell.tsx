/**
 * AgentExecutionDashboardShell — the container for the Agent Execution Dashboard.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import AgentExecutionOverview from './AgentExecutionOverview'
import AgentExecutionTasks from './AgentExecutionTasks'
import AgentExecutionAgents from './AgentExecutionAgents'
import AgentExecutionFiles from './AgentExecutionFiles'
import AgentExecutionTimeline from './AgentExecutionTimeline'
import AgentExecutionVerification from './AgentExecutionVerification'
import { createEventStore, type EventStoreApi } from '../../agentExecution/eventStore'
import {
  ensureImplementationPlanSeeded,
  resolveProjectForWorkspace,
} from '../../agentExecution/implementationPlanSeed'
import { useAgentExecutionRevision } from '../../agentExecution/useAgentExecutionRevision'
import { setAgentExecutionDiskRoot } from '../../agentExecution/persistence'
import {
  startAgentExecutionAdapters,
  stopAgentExecutionAdapters,
} from '../../agentExecution/runtime'

const store: EventStoreApi = createEventStore()

export type DashboardTab = 'overview' | 'tasks' | 'agents' | 'files' | 'timeline' | 'verification'

export function AgentExecutionDashboardShell({
  activeProjectId,
}: {
  /** Workspace root path when a folder is open (not an internal project id). */
  activeProjectId?: string | null
}) {
  const [tab, setTab] = useState<DashboardTab>('overview')
  const revision = useAgentExecutionRevision(store)

  const projectId = useMemo(
    () => resolveProjectForWorkspace(store, activeProjectId ?? null),
    [activeProjectId, revision],
  )

  useEffect(() => {
    setAgentExecutionDiskRoot(activeProjectId ?? null)
  }, [activeProjectId])

  useEffect(() => {
    if (!projectId) return
    void ensureImplementationPlanSeeded(store, projectId, activeProjectId ?? null)
    startAgentExecutionAdapters(store, projectId, 'cursor')
    return () => stopAgentExecutionAdapters()
  }, [projectId, activeProjectId])

  const tabs: { id: DashboardTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'agents', label: 'Agents' },
    { id: 'files', label: 'Files' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'verification', label: 'Verification' },
  ]

  const onNewProject = useCallback(() => {
    const name = window.prompt('Project name')
    if (!name) return
    store.createProject(name)
  }, [])

  const renderTab = (id: DashboardTab) => {
    switch (id) {
      case 'overview':
        return <AgentExecutionOverview projectId={projectId ?? undefined} />
      case 'tasks':
        return <AgentExecutionTasks projectId={projectId ?? undefined} />
      case 'agents':
        return <AgentExecutionAgents projectId={projectId ?? undefined} />
      case 'files':
        return <AgentExecutionFiles projectId={projectId ?? undefined} />
      case 'timeline':
        return <AgentExecutionTimeline projectId={projectId ?? undefined} />
      case 'verification':
        return <AgentExecutionVerification projectId={projectId ?? undefined} />
    }
  }

  if (!projectId) {
    return (
      <div className="agent-execution-dashboard side-bar-placeholder">
        <div className="side-bar-title">AGENT EXECUTION</div>
        <p className="side-bar-placeholder-hint">No projects yet.</p>
        <button type="button" className="agent-execution-create-btn" onClick={onNewProject}>
          Create project
        </button>
      </div>
    )
  }

  const project = store.getProject(projectId)

  return (
    <div className="agent-execution-dashboard">
      <div className="agent-execution-header">
        <div className="agent-execution-title">Agent Execution</div>
        {project?.name && (
          <div className="agent-execution-project-name" title={project.rootPath ?? undefined}>
            {project.name}
          </div>
        )}
        <div className="agent-execution-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`agent-execution-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="agent-execution-body">
        <div className="agent-execution-tab-panel">{renderTab(tab)}</div>
      </div>
    </div>
  )
}

export { store, type EventStoreApi }