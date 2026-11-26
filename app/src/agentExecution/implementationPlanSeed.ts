/**
 * Seed Agent Execution tasks from IMPLEMENTATION_STATUS.md / IMPLEMENTATION_PLAN.md.
 */

import type { EventStoreApi } from './eventStore'
import type { TaskStatus } from './types'
import { isElectronDesktop, readWorkspaceFile } from '../desktopWorkspace'
import bundledStatusMd from '../../../IMPLEMENTATION_STATUS.md?raw'
import bundledPlanMd from '../../../IMPLEMENTATION_PLAN.md?raw'

export type ParsedMilestone = {
  number: number
  title: string
  terminal: string
}

/** Lines like: `Milestone 3 — Project Overview — DONE` */
export function parseImplementationStatusMarkdown(md: string): ParsedMilestone[] {
  const out: ParsedMilestone[] = []
  for (const line of md.split('\n')) {
    const m = line.match(/^Milestone\s+(\d+)\s+—\s+(.+?)\s+—\s+(\S+)\s*$/u)
    if (!m) continue
    out.push({
      number: Number(m[1]),
      title: m[2].trim(),
      terminal: m[3].trim(),
    })
  }
  return out.sort((a, b) => a.number - b.number)
}

/** `| 1 | Tracking engine core | ... |` rows in IMPLEMENTATION_PLAN.md */
export function parseImplementationPlanTable(md: string): ParsedMilestone[] {
  const out: ParsedMilestone[] = []
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+)\|/u)
    if (!m) continue
    const title = m[2].trim()
    if (!title || title === 'Milestone' || title.startsWith('---')) continue
    out.push({ number: Number(m[1]), title, terminal: 'PLANNED' })
  }
  return out.sort((a, b) => a.number - b.number)
}

function statusForMilestone(terminal: string): TaskStatus | 'verified' {
  const t = terminal.toUpperCase().replace(/\s+/g, '_')
  if (t === 'DONE') return 'verified'
  if (t === 'IN_PROGRESS') return 'in_progress'
  return 'planned'
}

function projectHasMilestoneSeed(store: EventStoreApi, projectId: string): boolean {
  return store
    .tasks()
    .some((task) => task.projectId === projectId && task.title.startsWith('Milestone '))
}

function taskTitle(m: ParsedMilestone): string {
  return `Milestone ${m.number} — ${m.title}`
}

function loadBundledStatusMd(): string {
  return bundledStatusMd
}

function loadBundledPlanMd(): string {
  return bundledPlanMd
}

async function loadWorkspaceMarkdown(
  workspaceRoot: string,
  relPath: string,
): Promise<string | null> {
  if (!isElectronDesktop()) return null
  try {
    return await readWorkspaceFile(workspaceRoot, relPath)
  } catch {
    return null
  }
}

async function resolveMilestones(workspaceRoot?: string | null): Promise<ParsedMilestone[]> {
  if (workspaceRoot && isElectronDesktop()) {
    for (const rel of ['IMPLEMENTATION_STATUS.md', 'objectiv/IMPLEMENTATION_STATUS.md']) {
      const md = await loadWorkspaceMarkdown(workspaceRoot, rel)
      if (md) {
        const parsed = parseImplementationStatusMarkdown(md)
        if (parsed.length > 0) return parsed
      }
    }
    for (const rel of ['IMPLEMENTATION_PLAN.md', 'objectiv/IMPLEMENTATION_PLAN.md']) {
      const md = await loadWorkspaceMarkdown(workspaceRoot, rel)
      if (md) {
        const parsed = parseImplementationPlanTable(md)
        if (parsed.length > 0) return parsed
      }
    }
  }

  const statusMd = loadBundledStatusMd()
  const parsedStatus = parseImplementationStatusMarkdown(statusMd)
  if (parsedStatus.length > 0) return parsedStatus

  return parseImplementationPlanTable(loadBundledPlanMd())
}

const seedInflight = new Map<string, Promise<number>>()

/** Import milestones into the store when the project has no milestone tasks yet. */
export async function ensureImplementationPlanSeeded(
  store: EventStoreApi,
  projectId: string,
  workspaceRoot?: string | null,
): Promise<number> {
  if (projectHasMilestoneSeed(store, projectId)) return 0
  const inflight = seedInflight.get(projectId)
  if (inflight) return inflight

  const work = (async (): Promise<number> => {
    if (projectHasMilestoneSeed(store, projectId)) return 0

  const milestones = await resolveMilestones(workspaceRoot)
  if (milestones.length === 0) return 0

  const existingSession = store.sessions().find((s) => s.projectId === projectId)
  const session = existingSession ?? store.createSession(projectId, 'implementation-plan')

  store.emit({
    type: 'PLAN_CREATED',
    projectId,
    sessionId: session.id,
    payload: {
      source: 'IMPLEMENTATION_STATUS.md',
      milestoneCount: milestones.length,
    },
  })

  let created = 0
  for (const m of milestones) {
    const target = statusForMilestone(m.terminal)
    const task = store.createTask({
      projectId,
      sessionId: session.id,
      title: taskTitle(m),
      status: target === 'verified' ? 'planned' : target,
      priority: m.number <= 2 ? 'high' : 'medium',
    })
    store.updateTask(task.id, {
      verificationEvidence:
        target === 'verified'
          ? `Plan: ${m.terminal} · Execution: verified (see Verification tab)`
          : `Plan: ${m.terminal}`,
    })

    if (target === 'verified') {
      store.recordVerification({
        taskId: task.id,
        type: 'build',
        status: 'passed',
        evidence: 'Documented in IMPLEMENTATION_STATUS.md',
      })
      store.setTaskVerified(task.id, true, `Marked ${m.terminal} in IMPLEMENTATION_STATUS.md`)
    } else if (target === 'in_progress') {
      store.setTaskStatus(task.id, 'in_progress')
    }

    created++
  }

  store.save()
  return created
  })()

  seedInflight.set(projectId, work)
  try {
    return await work
  } finally {
    seedInflight.delete(projectId)
  }
}

export function resolveProjectForWorkspace(
  store: EventStoreApi,
  workspaceRoot?: string | null,
): string | null {
  if (workspaceRoot) {
    const byRoot = store.projects().find((p) => p.rootPath === workspaceRoot)
    if (byRoot) return byRoot.id
    const name = workspaceRoot.replace(/\/$/, '').split('/').pop() ?? 'Workspace'
    return store.createProject(name, workspaceRoot).id
  }

  const DEFAULT_NAME = 'Objectiv — Agent Execution'
  const existing = store.projects().find((p) => p.name === DEFAULT_NAME)
  if (existing) return existing.id

  if (store.projects().length > 0) return store.projects()[0].id

  return store.createProject(DEFAULT_NAME).id
}