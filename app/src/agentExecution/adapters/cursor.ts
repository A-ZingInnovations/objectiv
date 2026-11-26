/**
 * Cursor adapter stub (where supported).
 *
 * Translates Cursor agent/session events into the common Agent Execution event
 * protocol. The integration mechanism feeds parsed events into `handleEvent`.
 * Until a working event source is wired, this adapter stays not-connected per
 * the accuracy requirement: never pretend an integration is complete without a
 * working event source.
 */

import type { EventStoreApi } from '../eventStore'
import type { AgentAdapter, AdapterProvider } from './adapter'

export type CursorEvent =
  | { type: 'session.start'; sessionId: string; cwd?: string }
  | { type: 'tool.invoke'; tool: string; params: Record<string, unknown>; sessionId: string }
  | { type: 'tool.result'; tool: string; ok: boolean; output: unknown; sessionId: string }
  | { type: 'session.end'; sessionId: string; outcome?: 'completed' | 'error' }

export class CursorAdapter implements AgentAdapter {
  readonly provider: AdapterProvider = 'cursor'
  readonly name = 'Cursor'
  private connected_ = false

  start(opts: { store: EventStoreApi; sessionId: string; projectId: string }): () => void {
    const { store, sessionId, projectId } = opts
    const agent = store.createAgent({ sessionId, name: 'Cursor', provider: 'cursor' })
    const agentId = agent.id
    store.setAgentStatus(agentId, 'active')
    this.connected_ = true

    const handle = (event: CursorEvent) => {
      const aid = agentId
      switch (event.type) {
        case 'session.start':
          store.emit({
            type: 'SESSION_CREATED',
            projectId,
            sessionId,
            agentId: aid,
            payload: { cwd: event.cwd },
          })
          break
        case 'tool.invoke':
          store.emit({
            type: 'TASK_PROGRESS',
            projectId,
            sessionId,
            agentId: aid,
            payload: { kind: 'tool-invocation', tool: event.tool, params: event.params },
          })
          break
        case 'tool.result':
          store.emit({
            type: 'TASK_PROGRESS',
            projectId,
            sessionId,
            agentId: aid,
            payload: { kind: 'tool-result', tool: event.tool, ok: event.ok, output: event.output },
          })
          break
        case 'session.end':
          store.emit({
            type: event.outcome === 'error' ? 'AGENT_ERROR' : 'AGENT_IDLE',
            projectId,
            sessionId,
            agentId: aid,
            payload: { outcome: event.outcome ?? 'idle' },
          })
          store.setAgentStatus(
            aid,
            event.outcome === 'completed' ? 'completed' : event.outcome === 'error' ? 'error' : 'idle',
          )
          break
      }
    }

    ;(window as unknown as { __objectivCursor?: (e: CursorEvent) => void }).__objectivCursor = handle

    return () => {
      this.connected_ = false
      store.setAgentStatus(agentId, 'idle')
      ;(window as unknown as { __objectivCursor?: (e: CursorEvent) => void }).__objectivCursor = undefined
    }
  }

  get connected(): boolean {
    return this.connected_
  }
}
