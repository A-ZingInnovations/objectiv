import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import AgentChatPanel, { type AgentChatPanelHandle } from './AgentChatPanel';
import LlmSuiteMessage from './LlmSuiteMessage';
import LlmModelPicker from './LlmModelPicker';
import type { AgentMessage, FileActions, PendingEdit } from '../types';
import { useObjectivSettings } from '../settingsContext';
import { ollamaPing, suiteChat, suiteChatBaseFromSettings } from '../llmSuite';
import { formatTokenCount, messagesTokenTotal } from '../llmSuiteTokens';
import ObjectivBrandLockup from './ObjectivBrandLockup';
import LlmSuiteModelPull from './LlmSuiteModelPull';
import { useOllamaModelPull } from '../hooks/useOllamaModelPull';
import {
  createSpeechRecognition,
  speakAssistantReply,
  speechRecognitionSupported,
  speechSynthesisSupported,
  stopSpeaking,
} from '../llmSuiteVoice';
import {
  formatHistoryWhen,
  loadLlmSuiteChatHistory,
  loadLlmSuiteGlobalHistory,
  removeLlmSuiteGlobalHistoryEntry,
  saveLlmSuiteChatHistory,
  syncLlmSuiteGlobalHistoryOpenTabs,
  upsertLlmSuiteGlobalHistoryEntry,
  formatLlmSuiteHistoryModeLabel,
  normalizeLlmSuiteUiMode,
  type LlmSuiteGlobalHistoryEntry,
  type LlmSuiteHistoryMode,
  type LlmSuiteUiMode,
  type LlmSuiteWorkspaceSnapshot,
} from '../llmSuiteChatHistory';

export type LlmSuiteMode = LlmSuiteUiMode;

const MODES: { id: LlmSuiteUiMode; label: string }[] = [
  { id: 'coding', label: 'Agent' },
  { id: 'assistant', label: 'Chat' },
];

type ChatMsg = { role: 'user' | 'assistant'; content: string; labels?: string[] };

type Session = { id: string; title: string; messages: ChatMsg[]; updatedAt: number };

type QueuedMessage = { id: string; text: string };

type AgentTab = { id: string; title: string; messages: AgentMessage[]; updatedAt: number };

function newAgentTab(fallbackTitle: string): AgentTab {
  return {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: fallbackTitle,
    messages: [],
    updatedAt: Date.now(),
  };
}

function hydrateLlmSuiteState(
  workspaceSessionId: string,
  workspaceLabel: string | null | undefined,
): Pick<
  LlmSuiteWorkspaceSnapshot,
  'mode' | 'sessions' | 'activeSessionId' | 'agentTabs' | 'activeAgentTabId'
> {
  const snap = loadLlmSuiteChatHistory(workspaceSessionId);
  const fallbackTitle = workspaceLabel ?? 'New chat';
  const defaultSession = newSession();
  const defaultAgent = newAgentTab(fallbackTitle);
  if (!snap) {
    return {
      mode: 'coding',
      sessions: [defaultSession],
      activeSessionId: defaultSession.id,
      agentTabs: [defaultAgent],
      activeAgentTabId: defaultAgent.id,
    };
  }
  const sessions =
    snap.sessions.length > 0
      ? snap.sessions.map((s) => ({ ...s, updatedAt: s.updatedAt ?? Date.now() }))
      : [defaultSession];
  const agentTabs =
    snap.agentTabs.length > 0
      ? snap.agentTabs.map((t) => ({ ...t, updatedAt: t.updatedAt ?? Date.now() }))
      : [defaultAgent];
  const activeSessionId = sessions.some((s) => s.id === snap.activeSessionId)
    ? snap.activeSessionId
    : (sessions[0]?.id ?? '');
  const activeAgentTabId = agentTabs.some((t) => t.id === snap.activeAgentTabId)
    ? snap.activeAgentTabId
    : (agentTabs[0]?.id ?? '');
  return {
    mode: normalizeLlmSuiteUiMode(snap.mode),
    sessions,
    activeSessionId,
    agentTabs,
    activeAgentTabId,
  };
}

type Props = {
  agentRef: RefObject<AgentChatPanelHandle>;
  files: Record<string, string>;
  openTabs: string[];
  sidecarUrl: string;
  pilotUser: string;
  sessionId: string;
  workspaceLabel?: string | null;
  eventsDir?: string | null;
  hasWorkspace: boolean;
  onRunId?: (runId: string | null) => void;
  onApplyActions: (actions: FileActions) => void;
  onSidecarApplied?: () => void;
  onPendingChange?: (pending: PendingEdit | null) => void;
  onOpenDiff?: (pending: PendingEdit) => void;
  onOpenSettings: () => void;
};

function newSession(): Session {
  const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, title: 'New chat', messages: [], updatedAt: Date.now() };
}

function titleFromMessage(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= 22) return t || 'New chat';
  return `${t.slice(0, 20)}…`;
}

function chatTabTitle(messages: { role: string; content: string }[], fallback: string): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  return lastUser ? titleFromMessage(lastUser.content) : fallback;
}

function buildOpenGlobalEntries(
  workspaceKey: string,
  workspaceLabel: string | null | undefined,
  sessions: Session[],
  agentTabs: AgentTab[],
): LlmSuiteGlobalHistoryEntry[] {
  const label = workspaceLabel?.trim() || undefined;
  const open: LlmSuiteGlobalHistoryEntry[] = [];
  for (const t of agentTabs) {
    if (!t.messages.length) continue;
    open.push({
      id: t.id,
      chatMode: 'coding',
      title: chatTabTitle(t.messages, t.title),
      updatedAt: t.updatedAt,
      messages: [],
      agentMessages: t.messages,
      workspaceKey,
      workspaceLabel: label,
      openInWorkspace: workspaceKey,
    });
  }
  const sessionMode: LlmSuiteHistoryMode = 'assistant';
  for (const s of sessions) {
    if (!s.messages.length) continue;
    open.push({
      id: s.id,
      chatMode: sessionMode,
      title: s.title,
      updatedAt: s.updatedAt,
      messages: s.messages,
      workspaceKey,
      workspaceLabel: label,
      openInWorkspace: workspaceKey,
    });
  }
  return open;
}

export default function LlmSuiteRightPanel({
  agentRef,
  files,
  openTabs,
  sidecarUrl,
  pilotUser,
  sessionId,
  workspaceLabel,
  eventsDir,
  hasWorkspace,
  onRunId,
  onApplyActions,
  onSidecarApplied,
  onPendingChange,
  onOpenDiff,
  onOpenSettings,
}: Props) {
  const { settings, patchSettings } = useObjectivSettings();
  const bootRef = useRef(hydrateLlmSuiteState(sessionId, workspaceLabel));
  const [mode, setMode] = useState<LlmSuiteMode>(bootRef.current.mode);
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<Session[]>(bootRef.current.sessions);
  const [activeSessionId, setActiveSessionId] = useState(bootRef.current.activeSessionId);
  const [agentTabs, setAgentTabs] = useState<AgentTab[]>(bootRef.current.agentTabs);
  const [activeAgentTabId, setActiveAgentTabId] = useState(bootRef.current.activeAgentTabId);
  const [globalHistory, setGlobalHistory] = useState(() => loadLlmSuiteGlobalHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const workspaceKeyRef = useRef(sessionId);
  const persistRef = useRef({
    mode: bootRef.current.mode as LlmSuiteMode,
    activeSessionId: bootRef.current.activeSessionId,
    activeAgentTabId: bootRef.current.activeAgentTabId,
    sessions: bootRef.current.sessions,
    agentTabs: bootRef.current.agentTabs,
  });
  const [input, setInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const drainingRef = useRef(false);
  const pendingSendRef = useRef<{
    text: string;
    opts?: { steer?: boolean; interrupt?: boolean };
  } | null>(null);
  const busy = mode === 'coding' ? agentBusy : chatBusy;

  const ollamaPull = useOllamaModelPull(settings.ollamaBaseUrl, (patch) =>
    patchSettings(patch),
  );

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastSpokenRef = useRef('');
  /** Set when the user sent this turn after using the mic (STT). */
  const replyWithVoiceRef = useRef(false);
  const voiceInputForNextSendRef = useRef(false);

  const sttOk = speechRecognitionSupported();
  const ttsOk = speechSynthesisSupported();

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId],
  );

  const refreshOllama = useCallback(async () => {
    try {
      const ping = await ollamaPing(settings.ollamaBaseUrl);
      setOllamaOk(ping.ok);
    } catch {
      setOllamaOk(false);
    }
  }, [settings.ollamaBaseUrl]);

  useEffect(() => {
    void refreshOllama();
    const id = setInterval(() => void refreshOllama(), 20_000);
    return () => clearInterval(id);
  }, [refreshOllama]);

  useEffect(() => {
    persistRef.current = {
      mode,
      activeSessionId,
      activeAgentTabId,
      sessions,
      agentTabs,
    };
  });

  useEffect(() => {
    const persist = persistRef.current;
    const snapshot = { v: 1 as const, ...persist, archived: [] };
    const openTabs = buildOpenGlobalEntries(
      sessionId,
      workspaceLabel,
      persist.sessions,
      persist.agentTabs,
    );
    const t = window.setTimeout(() => {
      saveLlmSuiteChatHistory(sessionId, snapshot);
      syncLlmSuiteGlobalHistoryOpenTabs(sessionId, openTabs);
      setGlobalHistory(loadLlmSuiteGlobalHistory());
    }, 400);
    return () => clearTimeout(t);
  }, [
    sessionId,
    workspaceLabel,
    mode,
    activeSessionId,
    activeAgentTabId,
    sessions,
    agentTabs,
  ]);

  useEffect(() => {
    const prevKey = workspaceKeyRef.current;
    if (prevKey === sessionId) return;
    const prev = persistRef.current;
    saveLlmSuiteChatHistory(prevKey, { v: 1, archived: [], ...prev });
    syncLlmSuiteGlobalHistoryOpenTabs(
      prevKey,
      buildOpenGlobalEntries(prevKey, workspaceLabel, prev.sessions, prev.agentTabs),
    );
    const loaded = hydrateLlmSuiteState(sessionId, workspaceLabel);
    setMode(loaded.mode);
    setSessions(loaded.sessions);
    setActiveSessionId(loaded.activeSessionId);
    setAgentTabs(loaded.agentTabs);
    setActiveAgentTabId(loaded.activeAgentTabId);
    setGlobalHistory(loadLlmSuiteGlobalHistory());
    setHistoryOpen(false);
    workspaceKeyRef.current = sessionId;
  }, [sessionId, workspaceLabel]);

  useEffect(() => {
    if (!historyOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = historyRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setHistoryOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [historyOpen]);

  const activeAgentTab = useMemo(
    () => agentTabs.find((t) => t.id === activeAgentTabId) ?? agentTabs[0],
    [agentTabs, activeAgentTabId],
  );

  const sessionTokens = useMemo(() => {
    if (mode === 'coding') return messagesTokenTotal(activeAgentTab?.messages ?? []);
    return messagesTokenTotal(activeSession?.messages ?? []);
  }, [mode, activeAgentTab?.messages, activeSession?.messages]);

  const maybeSpeakReply = useCallback(
    (content: string) => {
      if (!settings.llmSuiteVoiceOutput || !content.trim()) return;
      if (!replyWithVoiceRef.current) return;
      if (/^error:/i.test(content.trim())) {
        replyWithVoiceRef.current = false;
        return;
      }
      replyWithVoiceRef.current = false;
      const key = content.slice(0, 120);
      if (lastSpokenRef.current === key) return;
      lastSpokenRef.current = key;
      speakAssistantReply(content, () => setSpeaking(true), () => setSpeaking(false));
    },
    [settings.llmSuiteVoiceOutput],
  );

  const onAgentMessagesChange = useCallback(
    (messages: AgentMessage[]) => {
      setAgentTabs((prev) =>
        prev.map((t) =>
          t.id === activeAgentTabId
            ? {
                ...t,
                messages,
                title: chatTabTitle(messages, workspaceLabel ?? 'New chat'),
                updatedAt: Date.now(),
              }
            : t,
        ),
      );
    },
    [activeAgentTabId, workspaceLabel],
  );

  useEffect(() => {
    if (!settings.llmSuiteVoiceOutput || agentBusy) return;
    if (mode === 'coding') {
      const msgs = activeAgentTab?.messages ?? [];
      const last = [...msgs].reverse().find((m) => m.role === 'assistant');
      if (last?.content) maybeSpeakReply(last.content);
    } else if (!chatBusy) {
      const msgs = activeSession?.messages ?? [];
      const last = [...msgs].reverse().find((m) => m.role === 'assistant');
      if (last?.content) maybeSpeakReply(last.content);
    }
  }, [
    agentBusy,
    chatBusy,
    mode,
    activeAgentTab?.messages,
    activeSession?.messages,
    settings.llmSuiteVoiceOutput,
    maybeSpeakReply,
  ]);

  useEffect(() => {
    if (agentBusy || chatBusy) lastSpokenRef.current = '';
  }, [agentBusy, chatBusy]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  function toggleVoiceInput() {
    if (!settings.llmSuiteVoiceInput || !sttOk) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = createSpeechRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let finalText = '';
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = r[0]?.transcript ?? '';
        if (r.isFinal) finalText += t;
        else interim += t;
      }
      if (finalText.trim()) {
        voiceInputForNextSendRef.current = true;
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${finalText.trim()}` : finalText.trim()));
      } else if (interim) setInput(interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function appendToSession(sessionId: string, msg: ChatMsg) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages, msg];
        const title =
          s.title === 'New chat' && msg.role === 'user'
            ? titleFromMessage(msg.content)
            : s.title;
        return { ...s, messages, title, updatedAt: Date.now() };
      }),
    );
  }

  function archiveClosedChat(item: LlmSuiteGlobalHistoryEntry) {
    const entry: LlmSuiteGlobalHistoryEntry = {
      ...item,
      workspaceKey: item.workspaceKey || sessionId,
      workspaceLabel: item.workspaceLabel ?? (workspaceLabel?.trim() || undefined),
      openInWorkspace: undefined,
    };
    upsertLlmSuiteGlobalHistoryEntry(entry);
    syncLlmSuiteGlobalHistoryOpenTabs(
      sessionId,
      buildOpenGlobalEntries(sessionId, workspaceLabel, sessions, agentTabs),
    );
    setGlobalHistory(loadLlmSuiteGlobalHistory());
  }

  function reopenArchivedChat(entry: LlmSuiteGlobalHistoryEntry) {
    setMode(normalizeLlmSuiteUiMode(entry.chatMode));
    if (entry.chatMode === 'coding') {
      if (agentTabs.some((t) => t.id === entry.id)) {
        setActiveAgentTabId(entry.id);
        setHistoryOpen(false);
        setHistoryQuery('');
        return;
      }
      const msgs = entry.agentMessages ?? [];
      const tab: AgentTab = {
        id: entry.id,
        title: entry.title,
        messages: msgs,
        updatedAt: entry.updatedAt,
      };
      setAgentTabs((prev) => [...prev, tab]);
      setActiveAgentTabId(tab.id);
      upsertLlmSuiteGlobalHistoryEntry({
        ...entry,
        workspaceKey: sessionId,
        workspaceLabel: workspaceLabel?.trim() || undefined,
        openInWorkspace: sessionId,
      });
    } else {
      if (sessions.some((s) => s.id === entry.id)) {
        setActiveSessionId(entry.id);
        setHistoryOpen(false);
        setHistoryQuery('');
        return;
      }
      const tab: Session = {
        id: entry.id,
        title: entry.title,
        messages: entry.messages,
        updatedAt: entry.updatedAt,
      };
      setSessions((prev) => [...prev, tab]);
      setActiveSessionId(tab.id);
      upsertLlmSuiteGlobalHistoryEntry({
        ...entry,
        workspaceKey: sessionId,
        workspaceLabel: workspaceLabel?.trim() || undefined,
        openInWorkspace: sessionId,
      });
    }
    setGlobalHistory(loadLlmSuiteGlobalHistory());
    setHistoryOpen(false);
    setHistoryQuery('');
  }

  function deleteArchivedChat(id: string) {
    removeLlmSuiteGlobalHistoryEntry(id);
    setGlobalHistory(loadLlmSuiteGlobalHistory());
  }

  const historyModeLabel = (m: LlmSuiteHistoryMode) => formatLlmSuiteHistoryModeLabel(m);

  const historyItems = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    const sorted = [...globalHistory].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        (row.workspaceLabel?.toLowerCase().includes(q) ?? false) ||
        row.messages.some((m) => m.content.toLowerCase().includes(q)) ||
        (row.agentMessages?.some((m) => m.content.toLowerCase().includes(q)) ?? false),
    );
  }, [globalHistory, historyQuery]);

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setChatBusy(false);
  }

  async function runLlmChat(text: string, opts?: { steer?: boolean; interrupt?: boolean }) {
    const sid = activeSession?.id;
    if (!sid) return;
    if (chatBusy && opts?.interrupt) {
      stopGeneration();
      await new Promise((r) => setTimeout(r, 60));
    }
    const prior = activeSession?.messages ?? [];
    const wireText = opts?.steer
      ? `[Steering] Change course based on this guidance:\n\n${text}`
      : text;
    const history = [...prior, { role: 'user' as const, content: wireText }];
    appendToSession(sid, {
      role: 'user',
      content: text,
      labels: opts?.steer ? ['steer'] : undefined,
    });
    setChatBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const reply = await suiteChat({
        ...suiteChatBaseFromSettings(settings),
        llmSuiteSessionId: sid,
        llmSuiteMode: mode,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      appendToSession(sid, { role: 'assistant', content: reply || '(empty)' });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        appendToSession(sid, { role: 'assistant', content: 'Stopped.' });
      } else {
        appendToSession(sid, {
          role: 'assistant',
          content: e instanceof Error ? e.message : String(e),
        });
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setChatBusy(false);
    }
  }

  async function dispatchMessage(text: string, opts?: { steer?: boolean; interrupt?: boolean }) {
    const hasTab =
      mode === 'coding'
        ? Boolean(activeAgentTabId && agentTabs.some((t) => t.id === activeAgentTabId))
        : Boolean(activeSessionId && sessions.some((s) => s.id === activeSessionId));
    if (!hasTab) {
      ensureActiveTab();
      pendingSendRef.current = { text, opts };
      return;
    }
    if (mode === 'coding') {
      await agentRef.current?.sendMessage(text, {
        interrupt: opts?.interrupt,
        steer: opts?.steer,
      });
      return;
    }
    await runLlmChat(text, opts);
  }

  useEffect(() => {
    const job = pendingSendRef.current;
    if (!job) return;
    const ready =
      mode === 'coding'
        ? Boolean(activeAgentTabId && agentTabs.some((t) => t.id === activeAgentTabId))
        : Boolean(activeSessionId && sessions.some((s) => s.id === activeSessionId));
    if (!ready) return;
    pendingSendRef.current = null;
    void dispatchMessage(job.text, job.opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeAgentTabId, activeSessionId, agentTabs, sessions]);

  function enqueueMessage(text: string) {
    const item: QueuedMessage = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
    };
    setQueue((prev) => [...prev, item]);
  }

  function removeQueued(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }

  function editQueued(id: string) {
    const item = queue.find((q) => q.id === id);
    if (!item) return;
    setInput(item.text);
    removeQueued(id);
  }

  async function sendQueuedNow(id: string) {
    const item = queue.find((q) => q.id === id);
    if (!item) return;
    removeQueued(id);
    drainingRef.current = true;
    try {
      if (busy) {
        await dispatchMessage(item.text, { interrupt: true });
      } else {
        await dispatchMessage(item.text);
      }
    } finally {
      drainingRef.current = false;
    }
  }

  async function submit() {
    const text = input.trim();
    if (!text) return;
    replyWithVoiceRef.current = voiceInputForNextSendRef.current;
    voiceInputForNextSendRef.current = false;
    setInput('');
    if (busy || drainingRef.current) {
      enqueueMessage(text);
      return;
    }
    await dispatchMessage(text);
  }

  /** Interrupt the current turn and send guidance immediately (Cursor-style steer). */
  async function steerNow() {
    const text = input.trim();
    if (!text) return;
    replyWithVoiceRef.current = voiceInputForNextSendRef.current;
    voiceInputForNextSendRef.current = false;
    setInput('');
    drainingRef.current = true;
    try {
      await dispatchMessage(text, { interrupt: true, steer: true });
    } finally {
      drainingRef.current = false;
    }
  }

  useEffect(() => {
    if (busy || drainingRef.current || queue.length === 0) return;
    const next = queue[0];
    if (!next) return;
    drainingRef.current = true;
    setQueue((prev) => prev.slice(1));
    void (async () => {
      try {
        await dispatchMessage(next.text);
      } finally {
        drainingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drain when busy clears / queue grows
  }, [busy, queue]);

  function openLlmSettings() {
    onOpenSettings();
    window.dispatchEvent(
      new CustomEvent('objectiv:open-settings', { detail: { category: 'LLM Suite' } }),
    );
  }

  function closeTab(id: string) {
    if (mode === 'coding') {
      const tab = agentTabs.find((t) => t.id === id);
      if (tab?.messages.length) {
        archiveClosedChat({
          id: tab.id,
          chatMode: 'coding',
          title: chatTabTitle(tab.messages, tab.title),
          updatedAt: tab.updatedAt,
          messages: [],
          agentMessages: tab.messages,
          workspaceKey: sessionId,
          workspaceLabel: workspaceLabel?.trim() || undefined,
        });
      }
      const closingActive = activeAgentTabId === id;
      setAgentTabs((prev) => prev.filter((t) => t.id !== id));
      if (closingActive) {
        const remaining = agentTabs.filter((t) => t.id !== id);
        setActiveAgentTabId(remaining[0]?.id ?? '');
        agentRef.current?.cancelTurn();
        setQueue([]);
        pendingSendRef.current = null;
      }
      return;
    }
    const session = sessions.find((s) => s.id === id);
    if (session?.messages.length) {
      archiveClosedChat({
        id: session.id,
        chatMode: mode,
        title: session.title,
        updatedAt: session.updatedAt,
        messages: session.messages,
        workspaceKey: sessionId,
        workspaceLabel: workspaceLabel?.trim() || undefined,
      });
    }
    const closingActive = activeSessionId === id;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (closingActive) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining[0]?.id ?? '');
      stopGeneration();
      setQueue([]);
      pendingSendRef.current = null;
    }
  }

  /** Ensure a chat tab exists before sending (allows zero tabs until compose). */
  function ensureActiveTab(): string {
    if (mode === 'coding') {
      if (activeAgentTab && agentTabs.some((t) => t.id === activeAgentTabId)) {
        return activeAgentTabId;
      }
      const t = newAgentTab(workspaceLabel ?? 'New chat');
      setAgentTabs((prev) => [...prev, t]);
      setActiveAgentTabId(t.id);
      return t.id;
    }
    if (activeSession && sessions.some((s) => s.id === activeSessionId)) {
      return activeSessionId;
    }
    const s = newSession();
    setSessions((prev) => [...prev, s]);
    setActiveSessionId(s.id);
    return s.id;
  }

  const tabs = mode === 'coding' ? agentTabs : sessions;
  const hasActiveTab =
    mode === 'coding'
      ? Boolean(activeAgentTabId && agentTabs.some((t) => t.id === activeAgentTabId))
      : Boolean(activeSessionId && sessions.some((s) => s.id === activeSessionId));

  return (
    <aside className="llm-suite-right" aria-label="LLM Suite">
      <header className="lf-topbar lf-topbar-slim">
        <div className="lf-topbar-left">
          <ObjectivBrandLockup className="lf-topbar-brand" size={22} variant="company" />
          {settings.llmProvider === 'ollama' && (
            <span
              className={`lf-ollama-pill ${ollamaOk ? 'ok' : ollamaOk === false ? 'bad' : ''}`}
              title={settings.ollamaBaseUrl}
            >
              Ollama {ollamaOk === null ? '…' : ollamaOk ? 'online' : 'offline'}
            </span>
          )}
        </div>
        <button
          type="button"
          className="lf-topbar-settings"
          title="LLM Suite settings"
          aria-label="Open LLM Suite settings"
          onClick={openLlmSettings}
        >
          <span className="codicon codicon-gear" aria-hidden />
        </button>
      </header>

      <div className="lf-mode-tabs" role="tablist" aria-label="LLM mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={`lf-mode-tab ${mode === m.id ? 'active' : ''}`}
            onClick={() => {
              setMode(m.id);
              setQueue([]);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="lf-session-bar">
        <div className="lf-session-tabs" role="tablist" aria-label="Chat sessions">
          {tabs.map((s) => {
            const selected =
              mode === 'coding' ? s.id === activeAgentTabId : s.id === activeSessionId;
            const title =
              mode === 'coding'
                ? chatTabTitle((s as AgentTab).messages, (s as AgentTab).title)
                : (s as Session).title;
            return (
              <div
                key={s.id}
                className={`lf-session-tab ${selected ? 'active' : ''}`}
                role="tab"
                aria-selected={selected}
                data-testid={selected ? 'chat-tab-active' : 'chat-tab'}
              >
                <button
                  type="button"
                  className="lf-session-tab-main"
                  disabled={busy}
                  onClick={() => {
                    if (mode === 'coding') setActiveAgentTabId(s.id);
                    else setActiveSessionId(s.id);
                  }}
                  title={title}
                >
                  <span className="lf-session-tab-title">{title}</span>
                </button>
                <button
                  type="button"
                  className="lf-session-tab-close"
                  data-testid="chat-tab-close"
                  title="Close tab"
                  aria-label={`Close ${title}`}
                  disabled={busy && selected}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(s.id);
                  }}
                >
                  <span className="codicon codicon-close" aria-hidden />
                </button>
              </div>
            );
          })}
          <div className="lf-history-wrap" ref={historyRef}>
            <button
              type="button"
              className="lf-session-new"
              data-testid="chat-history"
              disabled={busy}
              title="Previous chats"
              aria-label="Previous chats"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <span className="codicon codicon-history" aria-hidden />
            </button>
            {historyOpen && (
              <div className="lf-history-menu" role="dialog" aria-label="Previous chats">
                <input
                  type="search"
                  className="lf-history-search"
                  placeholder="Search chats…"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  aria-label="Search chats"
                />
                <ul className="lf-history-list">
                  {historyItems.length === 0 ? (
                    <li className="lf-history-empty">No saved chats yet</li>
                  ) : (
                    historyItems.map((row) => {
                      const openHere =
                        row.openInWorkspace === sessionId &&
                        (row.chatMode === 'coding'
                          ? agentTabs.some((t) => t.id === row.id)
                          : sessions.some((s) => s.id === row.id));
                      const openElsewhere =
                        !!row.openInWorkspace && row.openInWorkspace !== sessionId;
                      const archivedOnly = !row.openInWorkspace;
                      const wsLabel = row.workspaceLabel?.trim();
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            className="lf-history-item"
                            onClick={() => reopenArchivedChat(row)}
                          >
                            <span className="lf-history-item-title">{row.title}</span>
                            <span className="lf-history-item-meta">
                              {historyModeLabel(row.chatMode)} · {formatHistoryWhen(row.updatedAt)}
                              {wsLabel ? ` · ${wsLabel}` : ''}
                              {openHere ? ' · open' : ''}
                              {openElsewhere ? ' · open elsewhere' : ''}
                            </span>
                          </button>
                          {archivedOnly && (
                            <button
                              type="button"
                              className="lf-session-delete"
                              aria-label={`Delete ${row.title}`}
                              onClick={() => deleteArchivedChat(row.id)}
                            >
                              Delete
                            </button>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            className="lf-session-new"
            data-testid="chat-new"
            disabled={busy}
            title="New chat"
            aria-label="New chat"
            onClick={() => {
              if (mode === 'coding') {
                const t = newAgentTab(workspaceLabel ?? 'New chat');
                setAgentTabs((prev) => [...prev, t]);
                setActiveAgentTabId(t.id);
              } else {
                const s = newSession();
                setSessions((prev) => [...prev, s]);
                setActiveSessionId(s.id);
              }
            }}
          >
            <span className="codicon codicon-add" aria-hidden />
          </button>
        </div>
        {hasActiveTab && (
          <div className="lf-session-meta">
            <span>
              <strong>{formatTokenCount(sessionTokens)}</strong> tok
            </span>
          </div>
        )}
      </div>

      {!hasWorkspace && mode === 'coding' && (
        <div className="lf-open-project-hint">Open a folder for repo-aware answers.</div>
      )}

      <div className="llm-suite-conversation">
        {!hasActiveTab ? (
          <div className="lf-empty-chats">
            <p>No chats open</p>
            <button
              type="button"
              className="lf-empty-chats-new"
              disabled={busy}
              onClick={() => {
                if (mode === 'coding') {
                  const t = newAgentTab(workspaceLabel ?? 'New chat');
                  setAgentTabs([t]);
                  setActiveAgentTabId(t.id);
                } else {
                  const s = newSession();
                  setSessions([s]);
                  setActiveSessionId(s.id);
                }
              }}
            >
              New chat
            </button>
          </div>
        ) : mode === 'coding' ? (
          <AgentChatPanel
            key={activeAgentTabId}
            ref={agentRef}
            embedded
            initialMessages={activeAgentTab?.messages ?? []}
            files={files}
            openTabs={openTabs}
            sidecarUrl={sidecarUrl}
            pilotUser={pilotUser}
            sessionId={sessionId}
            workspaceLabel={workspaceLabel}
            eventsDir={eventsDir}
            onRunId={onRunId}
            onApplyActions={onApplyActions}
            onSidecarApplied={onSidecarApplied}
            onPendingChange={onPendingChange}
            onOpenDiff={onOpenDiff}
            mode={mode}
            onLoadingChange={setAgentBusy}
            onMessagesChange={onAgentMessagesChange}
            suiteLlm={suiteChatBaseFromSettings(settings)}
          />
        ) : (
          <div className="lf-chat-scroll lf-chat-static">
            {(activeSession?.messages ?? []).map((m, i) => (
              <LlmSuiteMessage
                key={i}
                message={{ role: m.role, content: m.content, labels: m.labels }}
                mode={mode}
              />
            ))}
            {busy && (
              <div className="lf-activity" role="status">
                <span className="lf-activity-dot" />
                <span>Thinking…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {busy && mode === 'coding' && (
        <div className="lf-activity lf-activity-footer" role="status">
          <span className="lf-activity-dot" />
          <span>Agent is working…</span>
        </div>
      )}

      <div className="lf-composer lf-composer-card">
        {settings.llmProvider === 'ollama' && (
          <LlmSuiteModelPull pull={ollamaPull} compact serverOnline={ollamaOk} />
        )}
        {queue.length > 0 && (
          <section className="lf-queue" aria-label="Queued messages">
            <div className="lf-queue-head">
              <button
                type="button"
                className="lf-queue-toggle"
                aria-expanded={queueExpanded}
                onClick={() => setQueueExpanded((v) => !v)}
              >
                <span
                  className={`codicon ${queueExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
                  aria-hidden
                />
                <span className="lf-queue-toggle-label">
                  {queue.length} Queued Message{queue.length === 1 ? '' : 's'}
                </span>
              </button>
              <button
                type="button"
                className="lf-queue-clear"
                title="Clear queue"
                onClick={() => setQueue([])}
              >
                Clear
              </button>
            </div>
            {queueExpanded && (
              <ul className="lf-queue-list">
                {queue.map((item) => (
                  <li key={item.id} className="lf-queue-item">
                    <span className="lf-queue-dot" aria-hidden />
                    <p className="lf-queue-text">{item.text}</p>
                    <div className="lf-queue-item-actions">
                      <button
                        type="button"
                        className="lf-queue-send-now"
                        onClick={() => void sendQueuedNow(item.id)}
                      >
                        Send now
                        <kbd className="lf-queue-kbd">⌘↵</kbd>
                      </button>
                      <button
                        type="button"
                        className="lf-queue-icon-btn"
                        title="Edit in composer"
                        aria-label="Edit queued message"
                        onClick={() => editQueued(item.id)}
                      >
                        <span className="codicon codicon-edit" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="lf-queue-icon-btn"
                        title="Remove"
                        aria-label="Remove from queue"
                        onClick={() => removeQueued(item.id)}
                      >
                        <span className="codicon codicon-trash" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <textarea
          className="lf-composer-input"
          data-testid="chat-input"
          placeholder={
            busy
              ? 'Add a follow-up…'
              : mode === 'coding'
                ? 'Plan, search, build…'
                : 'Message…'
          }
          rows={3}
          value={input}
          onChange={(e) => {
            if (!listening) voiceInputForNextSendRef.current = false;
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (e.metaKey || e.ctrlKey) void steerNow();
              else void submit();
            }
          }}
        />
        <div className="lf-composer-toolbar">
          <LlmModelPicker compact onOpenSettings={openLlmSettings} />
          <div className="lf-composer-actions">
            {settings.llmSuiteVoiceInput && sttOk && (
              <button
                type="button"
                className={`lf-btn-voice ${listening ? 'active' : ''}`}
                title={listening ? 'Stop listening' : 'Speak with microphone'}
                aria-label={listening ? 'Stop listening' : 'Start voice input'}
                disabled={busy}
                onClick={toggleVoiceInput}
              >
                <span
                  className={`codicon ${listening ? 'codicon-mic-filled' : 'codicon-mic'}`}
                  aria-hidden
                />
              </button>
            )}
            {settings.llmSuiteVoiceOutput && ttsOk && speaking && (
              <button
                type="button"
                className="lf-btn-voice lf-btn-voice-stop"
                title="Stop speaking"
                aria-label="Stop speaking"
                onClick={() => {
                  stopSpeaking();
                  setSpeaking(false);
                }}
              >
                <span className="codicon codicon-mute" aria-hidden />
              </button>
            )}
            <button
              type="button"
              className="lf-btn-stop"
              data-testid="chat-stop"
              disabled={!busy}
              onClick={() => {
                if (mode === 'coding') agentRef.current?.cancelTurn();
                else stopGeneration();
              }}
            >
              Stop
            </button>
            <button
              type="button"
              className="lf-btn-steer"
              data-testid="chat-steer"
              disabled={!busy || !input.trim()}
              title={
                busy
                  ? 'Interrupt and steer (⌘↵)'
                  : 'Steer is available while the agent is working'
              }
              onClick={() => void steerNow()}
            >
              Steer
            </button>
            <button
              type="button"
              className="lf-btn-send"
              data-testid="chat-send"
              disabled={!input.trim()}
              title={busy ? 'Add to queue' : 'Send'}
              onClick={() => void submit()}
            >
              {busy ? 'Queue' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
