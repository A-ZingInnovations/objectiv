/**
 * Workspace-scoped persistence for Agent Execution (.objectiv/agent-execution.json).
 */

import type { AgentExecutionStore } from './eventStore'
import { isElectronDesktop, readWorkspaceFile, writeWorkspaceFile } from '../desktopWorkspace'

export const AGENT_EXECUTION_DISK_PATH = '.objectiv/agent-execution.json'

let diskRoot: string | null = null

export function setAgentExecutionDiskRoot(root: string | null | undefined): void {
  diskRoot = root?.trim() ? root : null
}

export function getAgentExecutionDiskRoot(): string | null {
  return diskRoot
}

export async function loadStoreFromWorkspace(
  root: string,
): Promise<AgentExecutionStore | null> {
  if (!isElectronDesktop()) return null
  try {
    const raw = await readWorkspaceFile(root, AGENT_EXECUTION_DISK_PATH)
    return JSON.parse(raw) as AgentExecutionStore
  } catch {
    return null
  }
}

export async function mirrorStoreToWorkspace(
  root: string,
  store: AgentExecutionStore,
): Promise<void> {
  if (!isElectronDesktop() || !root.trim()) return
  try {
    await writeWorkspaceFile(root, AGENT_EXECUTION_DISK_PATH, JSON.stringify(store, null, 2))
  } catch {
    /* optional */
  }
}