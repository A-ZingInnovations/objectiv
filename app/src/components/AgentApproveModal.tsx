import type { PendingEdit } from '../types';
import AgentPendingApproval from './AgentPendingApproval';

type Props = {
  pending: PendingEdit;
  runId?: string | null;
  busy: boolean;
  onDecision: (decision: 'accept' | 'reject') => void;
  onOpenDiff?: () => void;
  onDismiss?: () => void;
};

export default function AgentApproveModal({
  pending,
  runId,
  busy,
  onDecision,
  onOpenDiff,
  onDismiss,
}: Props) {
  return (
    <div className="modal-overlay agent-approve-overlay" role="dialog" aria-modal="true">
      <div className="modal-card agent-approve-modal">
        <div className="modal-card-header">
          <span>
            Objective — approval required
            {runId && <span className="agent-run-id-inline"> · {runId}</span>}
          </span>
          {onDismiss && (
            <button type="button" className="modal-close" onClick={onDismiss} aria-label="Dismiss">
              ×
            </button>
          )}
        </div>
        <AgentPendingApproval
          pending={pending}
          busy={busy}
          onDecision={onDecision}
          onOpenDiff={onOpenDiff}
        />
      </div>
    </div>
  );
}
