/**
 * Claude Code adapter.
 *
 * Consumes Claude Code hook events (Session Start, User Prompt Submit, Pre/Post
 * Tool Use, Stop, Subagent Stop, Notification) and translates them into the
 * common Agent Execution event protocol.
 *
 * Claude Code emits hook events as JSON on stdin/stdout of configured hooks, or
 * as JSONL lines in its hooks event directory. This adapter reads hook payloads
 * passed to it (the integration mechanism feeds them in) — it never invents or
 * infers a status it did not observe.
 *
 * Hook events mapped:
 *   SessionStart         -> AGENT_STARTED + SESSION_CREATED
 *   UserPromptSubmit     -> user prompt event (TASK_PROGRESS with prompt payload)
 *   PreToolUse           -> tool invocation (TASK_PROGRESS)
 *   PostToolUse          -> tool result (TASK_PROGRESS / FILE_* / TEST_*)
 *   Stop                 -> AGENT_IDLE / AGENT_COMPLETED
 *   SubagentStop         -> agent subtask completion
 *   Notification         -> AGENT_ERROR
 *
 * The caller (Claude Code hook script) feeds parsed hook JSON to `handleEvent`.
 */

import type { EventStoreApi } from '../eventStore'
import type { AgentAdapter, AdapterProvider } from './adapter'

export type ClaudeCodeHookEvent =
  | { type: 'SessionStart'; sessionId: string; cwd?: string }
  | { type: 'UserPromptSubmit'; prompt: string; sessionId: string }
  | { type: 'PreToolUse'; tool: string; input: Record<string, unknown>; sessionId: string }
  | { type: 'PostToolUse'; tool: string; input: Record<string, unknown>; output: unknown; sessionId: string }
  | { type: 'Stop'; sessionId: string; outcome?: 'completed' | 'idle' | 'error'; message?: string }
  | { type: 'SubagentStop'; name: string; sessionId: string; outcome?: string }
  | { type: 'Notification'; message: string; sessionId: string }

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly provider: AdapterProvider = 'claude-code'
  readonly name = 'Claude Code'
  private connected_ = false

  start(opts: { store: EventStoreApi; sessionId: string; projectId: string }): () => void {
    const { store, sessionId, projectId } = opts
    const agent = store.createAgent({
      sessionId,
      name: 'Claude Code',
      provider: 'claude-code',
    })
    const agentId = agent.id
    store.setAgentStatus(agentId, 'active')
    this.connected_ = true

    // Hook handler entry point for the Claude Code hook integration.
    const handle = (event: ClaudeCodeHookEvent) => {
      switch (event.type) {
        case 'SessionStart':
          store.emit({
            type: 'SESSION_CREATED',
            projectId,
            sessionId,
            agentId,
            payload: { cwd: event.cwd },
          })
          store.setAgentStatus(agentId, 'active')
          break
        case 'UserPromptSubmit':
          store.emit({
            type: 'TASK_PROGRESS',
            projectId,
            sessionId,
            agentId,
            payload: { kind: 'user-prompt', prompt: event.prompt },
          })
          break
        case 'PreToolUse':
          store.emit({
            type: 'TASK_PROGRESS',
            projectId,
            sessionId,
            agentId,
            payload: { kind: 'tool-invocation', tool: event.tool, input: event.input },
          })
          break
        case 'PostToolUse': {
          const { tool, input, output } = event
          store.emit({
            type: 'TASK_PROGRESS',
            projectId,
            sessionId,
            agentId,
            payload: { kind: 'tool-result', tool, input, output },
          })
          // File actions observed from tool results are recorded when evidence exists.
          if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') {
            const path = (input as Record<string, unknown> | undefined)?.path ?? (input as Record<string, unknown> | undefined)?.file_path
            if (typeof path === 'string') {
              const currentAgent = store.getAgent(agentId)
              store.recordFileChange({
                projectId,
                sessionId,
                agentId,
                path,
                action: tool === 'Write' ? 'create' : 'modify',
                taskId: currentAgent?.currentTaskId,
              })
            }
          }
          break
        }
        case 'Stop':
          store.emit({
            type: event.outcome === 'error' ? 'AGENT_ERROR' : 'AGENT_IDLE',
            projectId,
            sessionId,
            agentId,
            payload: { outcome: event.outcome ?? 'idle', message: event.message },
          })
          store.setAgentStatus(
            agentId,
            event.outcome === 'completed' ? 'completed' : event.outcome === 'error' ? 'error' : 'idle',
          )
          if (event.message) store.recordAgentError(agentId, event.message)
          break
        case 'SubagentStop':
          store.emit({
            type: 'TASK_COMPLETED',
            projectId,
            sessionId,
            agentId,
            payload: { kind: 'subagent', name: event.name, outcome: event.outcome },
          })
          break
        case 'Notification':
          store.recordAgentError(agentId, event.message)
          store.emit({
            type: 'AGENT_ERROR',
            projectId,
            sessionId,
            agentId,
            payload: { kind: 'notification', message: event.message },
          })
          break
      }
    }

    // Expose the handler on window so a Claude Code hook script (injected via
    // the desktop bridge / preload) can call it with parsed hook JSON.
    ;(window as unknown as { __objectivClaudeCode?: (e: ClaudeCodeHookEvent) => void }).__objectivClaudeCode = handle

    return () => {
      this.connected_ = false
      store.setAgentStatus(agentId, 'idle')
      ;(window as unknown as { __objectivClaudeCode?: (e: ClaudeCodeHookEvent) => void }).__objectivClaudeCode = undefined
    }
  }

  get connected(): boolean {
    return this.connected_
  }
}
