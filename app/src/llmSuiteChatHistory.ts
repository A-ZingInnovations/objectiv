import type { AgentMessage } from './types';

export type LlmSuiteHistoryMode =
  | 'coding'
  | 'research'
  | 'browser'
  | 'document'
  | 'data'
  | 'assistant';

export type LlmSuiteChatMsg = { role: 'user' | 'assistant'; content: string; labels?: string[] };

export type LlmSuiteSessionRecord = {
  id: string;
  title: string;
  messages: LlmSuiteChatMsg[];
  updatedAt: number;
};

export type LlmSuiteAgentTabRecord = {
  id: string;
  title: string;
  messages: AgentMessage[];
  updatedAt: number;
};

export type LlmSuiteArchivedChat = {
  id: string;
  chatMode: LlmSuiteHistoryMode;
  title: string;
  updatedAt: number;
  messages: LlmSuiteChatMsg[];
  agentMessages?: AgentMessage[];
};

/** App-wide LLM Suite conversation (all workspaces, modes, open or archived). */
export type LlmSuiteGlobalHistoryEntry = LlmSuiteArchivedChat & {
  workspaceKey: string;
  workspaceLabel?: string;
  /** Set while the chat is an open tab in that workspace. */
  openInWorkspace?: string;
};

export type LlmSuiteWorkspaceSnapshot = {
  v: 1;
  mode: LlmSuiteUiMode;
  activeSessionId: string;
  activeAgentTabId: string;
  sessions: LlmSuiteSessionRecord[];
  agentTabs: LlmSuiteAgentTabRecord[];
};

/** @deprecated Use LlmSuiteWorkspaceSnapshot; archived lives in global history only. */
export type LlmSuiteHistorySnapshot = LlmSuiteWorkspaceSnapshot & {
  archived: LlmSuiteArchivedChat[];
};

const STORAGE_PREFIX = 'objectiv-llm-suite-chats-v1';
const GLOBAL_HISTORY_KEY = 'objectiv-llm-suite-global-history-v2';
const LEGACY_MIGRATION_FLAG = 'objectiv-llm-suite-global-history-migrated-v2';
const MAX_GLOBAL_ENTRIES = 200;
const MAX_MSG_CHARS = 120_000;

function workspaceStorageKey(workspaceSessionId: string): string {
  const id = workspaceSessionId.trim() || 'objectiv-demo';
  return `${STORAGE_PREFIX}-${id}`;
}

function clampText(s: string): string {
  if (s.length <= MAX_MSG_CHARS) return s;
  return `${s.slice(0, MAX_MSG_CHARS)}\n\n…[truncated for storage]`;
}

function sanitizeChatMsg(m: unknown): LlmSuiteChatMsg | null {
  if (!m || typeof m !== 'object') return null;
  const row = m as Record<string, unknown>;
  const role = row.role;
  const content = row.content;
  if (role !== 'user' && role !== 'assistant') return null;
  if (typeof content !== 'string') return null;
  const labels = Array.isArray(row.labels)
    ? row.labels.filter((x): x is string => typeof x === 'string')
    : undefined;
  return { role, content: clampText(content), labels: labels?.length ? labels : undefined };
}

function sanitizeAgentMsg(m: unknown): AgentMessage | null {
  if (!m || typeof m !== 'object') return null;
  const row = m as Record<string, unknown>;
  const role = row.role;
  const content = row.content;
  if (role !== 'user' && role !== 'assistant') return null;
  if (typeof content !== 'string') return null;
  const labels = Array.isArray(row.labels)
    ? row.labels.filter((x): x is string => typeof x === 'string')
    : undefined;
  const runId = typeof row.runId === 'string' ? row.runId : undefined;
  return {
    role,
    content: clampText(content),
    labels: labels?.length ? labels : undefined,
    runId,
  };
}

function sanitizeSession(raw: unknown): LlmSuiteSessionRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const title = typeof row.title === 'string' ? row.title : 'New chat';
  if (!id) return null;
  const messages = Array.isArray(row.messages)
    ? row.messages.map(sanitizeChatMsg).filter((m): m is LlmSuiteChatMsg => !!m)
    : [];
  const updatedAt =
    typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt)
      ? row.updatedAt
      : Date.now();
  return { id, title, messages, updatedAt };
}

function sanitizeAgentTab(raw: unknown): LlmSuiteAgentTabRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const title = typeof row.title === 'string' ? row.title : 'New chat';
  if (!id) return null;
  const messages = Array.isArray(row.messages)
    ? row.messages.map(sanitizeAgentMsg).filter((m): m is AgentMessage => !!m)
    : [];
  const updatedAt =
    typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt)
      ? row.updatedAt
      : Date.now();
  return { id, title, messages, updatedAt };
}

const MODES: LlmSuiteHistoryMode[] = [
  'coding',
  'research',
  'browser',
  'document',
  'data',
  'assistant',
];

/** Active UI only: Agent vs Chat. Legacy history modes map to Chat. */
export type LlmSuiteUiMode = 'coding' | 'assistant';

export function normalizeLlmSuiteUiMode(mode: LlmSuiteHistoryMode): LlmSuiteUiMode {
  return mode === 'coding' ? 'coding' : 'assistant';
}

const HISTORY_MODE_LABELS: Record<LlmSuiteHistoryMode, string> = {
  coding: 'Agent',
  research: 'Research',
  browser: 'Browser',
  document: 'Docs',
  data: 'Data',
  assistant: 'Chat',
};

export function formatLlmSuiteHistoryModeLabel(mode: LlmSuiteHistoryMode): string {
  return HISTORY_MODE_LABELS[mode] ?? mode;
}

function isMode(v: unknown): v is LlmSuiteHistoryMode {
  return typeof v === 'string' && (MODES as string[]).includes(v);
}

function sanitizeArchived(raw: unknown): LlmSuiteArchivedChat | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const title = typeof row.title === 'string' ? row.title : 'Chat';
  const chatMode = isMode(row.chatMode) ? row.chatMode : 'assistant';
  if (!id) return null;
  const updatedAt =
    typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt)
      ? row.updatedAt
      : Date.now();
  const messages = Array.isArray(row.messages)
    ? row.messages.map(sanitizeChatMsg).filter((m): m is LlmSuiteChatMsg => !!m)
    : [];
  const agentMessages = Array.isArray(row.agentMessages)
    ? row.agentMessages.map(sanitizeAgentMsg).filter((m): m is AgentMessage => !!m)
    : undefined;
  const hasContent = messages.length > 0 || (agentMessages && agentMessages.length > 0);
  if (!hasContent) return null;
  return {
    id,
    chatMode,
    title,
    updatedAt,
    messages,
    agentMessages: agentMessages?.length ? agentMessages : undefined,
  };
}

function sanitizeGlobalEntry(raw: unknown): LlmSuiteGlobalHistoryEntry | null {
  const base = sanitizeArchived(raw);
  if (!base) return null;
  const row = raw as Record<string, unknown>;
  const workspaceKey =
    typeof row.workspaceKey === 'string' && row.workspaceKey.trim()
      ? row.workspaceKey.trim()
      : 'objectiv-demo';
  const workspaceLabel =
    typeof row.workspaceLabel === 'string' && row.workspaceLabel.trim()
      ? row.workspaceLabel.trim()
      : undefined;
  const openInWorkspace =
    typeof row.openInWorkspace === 'string' && row.openInWorkspace.trim()
      ? row.openInWorkspace.trim()
      : undefined;
  return {
    ...base,
    workspaceKey,
    workspaceLabel,
    openInWorkspace,
  };
}

function coerceWorkspaceSnapshot(raw: unknown): LlmSuiteWorkspaceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.v !== 1) return null;
  const storedMode = isMode(row.mode) ? row.mode : 'coding';
  const mode = normalizeLlmSuiteUiMode(storedMode);
  const sessions = Array.isArray(row.sessions)
    ? row.sessions.map(sanitizeSession).filter((s): s is LlmSuiteSessionRecord => !!s)
    : [];
  const agentTabs = Array.isArray(row.agentTabs)
    ? row.agentTabs.map(sanitizeAgentTab).filter((t): t is LlmSuiteAgentTabRecord => !!t)
    : [];
  let activeSessionId = typeof row.activeSessionId === 'string' ? row.activeSessionId : '';
  let activeAgentTabId = typeof row.activeAgentTabId === 'string' ? row.activeAgentTabId : '';
  if (activeSessionId && !sessions.some((s) => s.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id ?? '';
  }
  if (activeAgentTabId && !agentTabs.some((t) => t.id === activeAgentTabId)) {
    activeAgentTabId = agentTabs[0]?.id ?? '';
  }
  return {
    v: 1,
    mode,
    activeSessionId,
    activeAgentTabId,
    sessions,
    agentTabs,
  };
}

function readGlobalEntriesRaw(): LlmSuiteGlobalHistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GLOBAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return [];
    const row = parsed as Record<string, unknown>;
    if (row.v !== 2 || !Array.isArray(row.entries)) return [];
    return row.entries
      .map(sanitizeGlobalEntry)
      .filter((e): e is LlmSuiteGlobalHistoryEntry => !!e)
      .slice(0, MAX_GLOBAL_ENTRIES);
  } catch {
    return [];
  }
}

function writeGlobalEntries(entries: LlmSuiteGlobalHistoryEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = entries
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_GLOBAL_ENTRIES);
    localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify({ v: 2, entries: trimmed }));
  } catch {
    /* quota */
  }
}

function migrateLegacyPerWorkspaceArchives(): void {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(LEGACY_MIGRATION_FLAG)) return;
  const byId = new Map<string, LlmSuiteGlobalHistoryEntry>(
    readGlobalEntriesRaw().map((e) => [e.id, e]),
  );
  const prefix = `${STORAGE_PREFIX}-`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const workspaceKey = key.slice(prefix.length);
    let snap: LlmSuiteHistorySnapshot | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      const ws = coerceWorkspaceSnapshot(parsed);
      if (!ws) continue;
      const row = parsed as Record<string, unknown>;
      const archived = Array.isArray(row.archived)
        ? row.archived.map(sanitizeArchived).filter((a): a is LlmSuiteArchivedChat => !!a)
        : [];
      snap = { ...ws, archived };
    } catch {
      continue;
    }
    if (!snap) continue;
    for (const a of snap.archived) {
      if (byId.has(a.id)) continue;
      byId.set(a.id, {
        ...a,
        workspaceKey,
        openInWorkspace: undefined,
      });
    }
    for (const t of snap.agentTabs) {
      if (!t.messages.length) continue;
      const existing = byId.get(t.id);
      if (existing?.openInWorkspace) continue;
      byId.set(t.id, {
        id: t.id,
        chatMode: 'coding',
        title: t.title,
        updatedAt: t.updatedAt,
        messages: [],
        agentMessages: t.messages,
        workspaceKey,
        openInWorkspace: workspaceKey,
      });
    }
    for (const s of snap.sessions) {
      if (!s.messages.length) continue;
      const existing = byId.get(s.id);
      if (existing?.openInWorkspace) continue;
      byId.set(s.id, {
        id: s.id,
        chatMode: snap.mode === 'coding' ? 'assistant' : snap.mode,
        title: s.title,
        updatedAt: s.updatedAt,
        messages: s.messages,
        workspaceKey,
        openInWorkspace: workspaceKey,
      });
    }
  }
  writeGlobalEntries([...byId.values()]);
  try {
    localStorage.setItem(LEGACY_MIGRATION_FLAG, '1');
  } catch {
    /* ignore */
  }
}

export function ensureLlmSuiteGlobalHistoryMigrated(): void {
  migrateLegacyPerWorkspaceArchives();
}

export function loadLlmSuiteGlobalHistory(): LlmSuiteGlobalHistoryEntry[] {
  ensureLlmSuiteGlobalHistoryMigrated();
  return readGlobalEntriesRaw().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertLlmSuiteGlobalHistoryEntry(entry: LlmSuiteGlobalHistoryEntry): void {
  ensureLlmSuiteGlobalHistoryMigrated();
  const entries = readGlobalEntriesRaw();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    const prev = entries[idx]!;
    entries[idx] = {
      ...prev,
      ...entry,
      chatMode: entry.chatMode || prev.chatMode,
      openInWorkspace: entry.openInWorkspace === undefined ? undefined : entry.openInWorkspace,
    };
  } else {
    entries.unshift(entry);
  }
  writeGlobalEntries(entries);
}

export function removeLlmSuiteGlobalHistoryEntry(id: string): void {
  ensureLlmSuiteGlobalHistoryMigrated();
  writeGlobalEntries(readGlobalEntriesRaw().filter((e) => e.id !== id));
}

/** Merge open tabs for one workspace into the app-wide history list. */
export function syncLlmSuiteGlobalHistoryOpenTabs(
  workspaceKey: string,
  openTabs: LlmSuiteGlobalHistoryEntry[],
): void {
  ensureLlmSuiteGlobalHistoryMigrated();
  const openIds = new Set(openTabs.map((t) => t.id));
  const entries = readGlobalEntriesRaw();
  const byId = new Map(entries.map((e) => [e.id, e]));

  for (const tab of openTabs) {
    const prev = byId.get(tab.id);
    byId.set(tab.id, {
      ...(prev ?? tab),
      ...tab,
      workspaceKey: tab.workspaceKey || workspaceKey,
      openInWorkspace: workspaceKey,
    });
  }

  for (const e of byId.values()) {
    if (e.openInWorkspace === workspaceKey && !openIds.has(e.id)) {
      byId.set(e.id, { ...e, openInWorkspace: undefined });
    }
  }

  writeGlobalEntries([...byId.values()]);
}

export function loadLlmSuiteChatHistory(workspaceSessionId: string): LlmSuiteHistorySnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(workspaceStorageKey(workspaceSessionId));
    if (!raw) return null;
    const ws = coerceWorkspaceSnapshot(JSON.parse(raw) as unknown);
    if (!ws) return null;
    return { ...ws, archived: [] };
  } catch {
    return null;
  }
}

export function saveLlmSuiteChatHistory(
  workspaceSessionId: string,
  snapshot: LlmSuiteHistorySnapshot,
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const { mode, activeSessionId, activeAgentTabId, sessions, agentTabs } = snapshot;
    const workspace: LlmSuiteWorkspaceSnapshot = {
      v: 1,
      mode,
      activeSessionId,
      activeAgentTabId,
      sessions,
      agentTabs,
    };
    localStorage.setItem(workspaceStorageKey(workspaceSessionId), JSON.stringify(workspace));
  } catch {
    /* quota or private mode */
  }
}

export function formatHistoryWhen(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}