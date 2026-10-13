import { useRef, useState, type RefObject } from 'react';
import AgentChatPanel, { type AgentChatPanelHandle } from './AgentChatPanel';
import ModelChatPanel, { type ModelChatPanelHandle } from './ModelChatPanel';
import type { FileActions, PendingEdit } from '../types';

type ChatMode = 'chat' | 'agent';

type Props = {
  files: Record<string, string>;
  openTabs: string[];
  sidecarUrl: string;
  pilotUser: string;
  sessionId: string;
  workspaceLabel?: string | null;
  eventsDir?: string | null;
  onRunId?: (runId: string | null) => void;
  onApplyActions: (actions: FileActions) => void;
  onSidecarApplied?: () => void;
  onPendingChange?: (pending: PendingEdit | null) => void;
  onOpenDiff?: (pending: PendingEdit) => void;
  onOpenLlmSettings?: () => void;
  agentRef?: RefObject<AgentChatPanelHandle>;
};

export default function ChatSidePanel({
  files,
  openTabs,
  sidecarUrl,
  pilotUser,
  sessionId,
  workspaceLabel,
  eventsDir,
  onRunId,
  onApplyActions,
  onSidecarApplied,
  onPendingChange,
  onOpenDiff,
  onOpenLlmSettings,
  agentRef,
}: Props) {
  const [mode, setMode] = useState<ChatMode>('chat');
  const modelChatRef = useRef<ModelChatPanelHandle>(null);

  return (
    <>
      <div className="side-bar-title">
        <span>{mode === 'chat' ? 'CHAT' : 'AGENT'}</span>
        <div className="side-bar-actions">
          {mode === 'chat' && (
            <button
              type="button"
              className="action wide"
              title="New chat"
              aria-label="New chat"
              onClick={() => modelChatRef.current?.newChat()}
            >
              New
            </button>
          )}
        </div>
      </div>
      <div className="chat-mode-tabs" role="tablist" aria-label="Chat mode">
        <button
          type="button"
          role="tab"
          className={`chat-mode-tab ${mode === 'chat' ? 'active' : ''}`}
          aria-selected={mode === 'chat'}
          onClick={() => setMode('chat')}
        >
          Chat
        </button>
        <button
          type="button"
          role="tab"
          className={`chat-mode-tab ${mode === 'agent' ? 'active' : ''}`}
          aria-selected={mode === 'agent'}
          onClick={() => setMode('agent')}
        >
          Agent
        </button>
      </div>
      <div className="side-bar-panel-fill">
        {mode === 'chat' ? (
          <ModelChatPanel ref={modelChatRef} onOpenLlmSettings={onOpenLlmSettings} />
        ) : (
          <AgentChatPanel
            ref={agentRef}
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
          />
        )}
      </div>
    </>
  );
}
