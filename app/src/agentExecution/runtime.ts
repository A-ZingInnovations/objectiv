/**
 * Live Agent Execution runtime — start provider adapters for the active project.
 * Hooks: window.__objectivCursor, window.__objectivClaudeCode, window.__objectivCodex
 */

import type { EventStoreApi } from './eventStore'
import { ClaudeCodeAdapter } from './adapters/claudeCode'
import { CursorAdapter } from './adapters/cursor'
import { CodexAdapter } from './adapters/codex'
import type { AgentAdapter, AdapterProvider } from './adapters/adapter'

const LIVE_SESSION = 'live'

let activeStops: (() => void)[] = []

function ensureLiveSession(store: EventStoreApi, projectId: string): string {
  const existing = store
    .sessions()
    .find((s) => s.projectId === projectId && s.name === LIVE_SESSION)
  if (existing) return existing.id
  return store.createSession(projectId, LIVE_SESSION).id
}

function adapterFor(provider: AdapterProvider): AgentAdapter {
  switch (provider) {
    case 'claude-code':
      return new ClaudeCodeAdapter()
    case 'openai-codex':
      return new CodexAdapter()
    case 'cursor':
    default:
      return new CursorAdapter()
  }
}

/** Start one adapter for the project (default: Cursor hooks on window). */
export function startAgentExecutionAdapters(
  store: EventStoreApi,
  projectId: string,
  provider: AdapterProvider = 'cursor',
): void {
  stopAgentExecutionAdapters()
  const sessionId = ensureLiveSession(store, projectId)
  const adapter = adapterFor(provider)
  activeStops.push(adapter.start({ store, sessionId, projectId }))
}

export function stopAgentExecutionAdapters(): void {
  for (const stop of activeStops) stop()
  activeStops = []
}

export function agentExecutionHookStatus(): Record<AdapterProvider, boolean> {
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {}
  return {
    cursor: typeof w.__objectivCursor === 'function',
    'claude-code': typeof w.__objectivClaudeCode === 'function',
    'openai-codex': typeof w.__objectivCodex === 'function',
    custom: false,
  }
}