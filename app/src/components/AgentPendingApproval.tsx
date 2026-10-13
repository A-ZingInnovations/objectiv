import type { PendingEdit } from '../types';

type Props = {
  pending: PendingEdit;
  busy: boolean;
  onDecision: (decision: 'accept' | 'reject') => void;
  onOpenDiff?: () => void;
};

export default function AgentPendingApproval({ pending, busy, onDecision, onOpenDiff }: Props) {
  const canDiff =
    pending.before !== undefined &&
    pending.after !== undefined &&
    Boolean(pending.path || pending.title);
  return (
    <div className="agent-approval">
      <div className="agent-approval-title">{pending.title}</div>
      {pending.message && <pre className="agent-diff">{pending.message}</pre>}
      {pending.command && <pre className="agent-diff">{pending.command}</pre>}
      {pending.before !== undefined && pending.after !== undefined && (
        <div className="agent-diff-split">
          <pre className="agent-diff before">{pending.before || '(empty)'}</pre>
          <pre className="agent-diff after">{pending.after}</pre>
        </div>
      )}
      <div className="agent-approval-actions">
        {canDiff && onOpenDiff && (
          <button type="button" disabled={busy} className="secondary" onClick={onOpenDiff}>
            Open diff
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => onDecision('accept')}>
          Accept
        </button>
        <button type="button" disabled={busy} className="secondary" onClick={() => onDecision('reject')}>
          Reject
        </button>
      </div>
    </div>
  );
}
