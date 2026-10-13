/** Headers and session ids for Objective sidecar (G1 / trajectories). */

export const OBJECTIV_SURFACE = 'objectiv';

export function sidecarRequestHeaders(pilotUser: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Objective-Pilot-User': pilotUser,
    'X-Objective-Surface': OBJECTIV_SURFACE,
  };
}

export function sessionIdForWorkspace(workspaceRoot: string | null): string {
  if (!workspaceRoot) return 'objectiv-demo';
  let h = 0;
  for (let i = 0; i < workspaceRoot.length; i++) {
    h = (Math.imul(31, h) + workspaceRoot.charCodeAt(i)) | 0;
  }
  return `objectiv-${(h >>> 0).toString(16)}`;
}

export type SidecarConfig = {
  workspace?: string;
  model?: string;
  llm?: string;
  harness?: string;
  eventsDir?: string;
  pilotAllowlist?: boolean;
};
