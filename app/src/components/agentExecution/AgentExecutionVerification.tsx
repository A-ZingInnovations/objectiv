/**
 * AgentExecutionVerification — Testing & Verification module.
 *
 * Build results, unit/integration test results, lint results, failed test
 * details and verification history — all backed by real evidence, never
 * inferred success.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { store } from './AgentExecutionDashboardShell'
import type { VerificationResult } from '../../agentExecution/types'
import { useAgentExecutionRevision } from '../../agentExecution/useAgentExecutionRevision'

function statusIcon(status: VerificationResult['status']): string {
  switch (status) {
    case 'passed': return 'check'
    case 'failed': return 'error'
    case 'pending': return 'circle-outline'
    default: return 'circle-outline'
  }
}

function typeLabel(type: VerificationResult['type']): string {
  switch (type) {
    case 'build': return 'Build'
    case 'unit-test': return 'Unit tests'
    case 'integration-test': return 'Integration tests'
    case 'lint': return 'Lint'
    case 'custom': return 'Custom'
    default: return type
  }
}

export default function AgentExecutionVerification({ projectId }: { projectId?: string | null }) {
  const [results, setResults] = useState<VerificationResult[]>([])
  const revision = useAgentExecutionRevision(store)

  const refresh = useCallback(() => {
    const all = store.verificationResults()
    if (!projectId) { setResults(all); return }
    const taskIds = new Set(store.tasks().filter((t) => t.projectId === projectId).map((t) => t.id))
    setResults(all.filter((r) => taskIds.has(r.taskId)))
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh, revision])

  const byType = useMemo(() => {
    const map: Record<VerificationResult['type'], VerificationResult[]> = {
      build: [], 'unit-test': [], 'integration-test': [], lint: [], custom: [],
    }
    for (const r of results) map[r.type].push(r)
    return map
  }, [results])

  const latestByType = useMemo(() => {
    const map: Partial<Record<VerificationResult['type'], VerificationResult>> = {}
    for (const type of Object.keys(byType)) {
      const t = type as VerificationResult['type']
      map[t] = byType[t].length > 0 ? byType[t][0] : undefined
    }
    return map
  }, [byType])

  return (
    <div className="agent-execution-module">
      <div className="side-bar-title">TESTING &amp; VERIFICATION</div>
      <div className="agent-execution-verify-toolbar">
        {(['build', 'unit-test', 'integration-test', 'lint', 'custom'] as const).map((t) => {
          const r = latestByType[t]
          return (
            <button key={t} type="button" className="agent-execution-verify-pill">
              <span className={`codicon codicon-${statusIcon(r ? r.status : 'pending')}`} aria-hidden />
              {typeLabel(t)}: {r ? r.status : '—'}
            </button>
          )
        })}
      </div>
      <div className="side-bar-title" style={{ marginTop: 10, marginBottom: 6 }}>Verification history</div>
      <ul className="agent-execution-verify-history">
        {results.length === 0 ? (
          <li className="side-bar-placeholder-hint">No verification results.</li>
        ) : (
          results.slice(0, 20).map((r) => {
            const task = store.getTask(r.taskId)
            return (
              <li key={r.id} className="agent-execution-verify-row">
                <span className={`codicon codicon-${statusIcon(r.status)}`} aria-hidden />
                <span className="agent-execution-verify-type">{typeLabel(r.type)}</span>
                <span className={`agent-execution-verify-status agent-execution-verify-${r.status}`}>{r.status}</span>
                <span className="agent-execution-verify-evidence">{r.evidence}</span>
                {task && <span className="agent-execution-verify-task">task {task.id.slice(0, 8)}</span>}
              </li>
            )
          })
        )}
      </ul>
      {results.length > 20 && <p className="side-bar-placeholder-hint">Showing 20 of {results.length} results.</p>}
    </div>
  )
}
