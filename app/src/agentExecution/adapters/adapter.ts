/**
 * Agent adapter interface — provider-independent translation of provider-specific
 * events into the common Agent Execution event protocol.
 *
 * Each adapter owns one event source. An adapter must not report a status as
 * confirmed unless it observed the corresponding event from its provider.
 */

import type { EventStoreApi } from '../eventStore'
import type { AgentEvent, AgentEventType } from '../types'

export type AdapterProvider = 'claude-code' | 'openai-codex' | 'cursor' | 'custom'

export interface AgentAdapter {
  readonly provider: AdapterProvider
  /** Human-readable name of the integration. */
  readonly name: string
  /** Start consuming events from the provider. Returns a stop function. */
  start(opts: { store: EventStoreApi; sessionId: string; projectId: string }): () => void
  /** Whether this adapter is currently connected to a live event source. */
  readonly connected: boolean
}

/** Translate a provider observation into a common event. */
export function adaptEvent(opts: {
  store: EventStoreApi
  sessionId: string
  projectId: string
  agentId: string
  type: AgentEventType
  payload: Record<string, unknown>
}): AgentEvent {
  const { store, sessionId, projectId, agentId, type, payload } = opts
  return store.emit({
    type,
    projectId,
    sessionId,
    agentId,
    payload,
  })
}
