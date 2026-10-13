import type { PendingEdit } from './types';

import { sidecarRequestHeaders } from './objectiveSidecar';

export type ApproveResult = {
  reply?: string;
  label?: string;
  runId?: string;
  awaitingApproval?: boolean;
  pending?: PendingEdit;
};

export async function submitSidecarApproval(
  sidecarUrl: string,
  pilotUser: string,
  sessionId: string,
  decision: 'accept' | 'reject',
): Promise<ApproveResult> {
  const base = sidecarUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/approve`, {
    method: 'POST',
    headers: sidecarRequestHeaders(pilotUser),
    body: JSON.stringify({ sessionId, decision }),
  });
  const data = (await res.json()) as ApproveResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
