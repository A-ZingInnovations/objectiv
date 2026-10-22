/** Code as a Friend (CASF) — Enterprise team live-coding workbench (MVP shell). */

export const CASF_TAB_PREFIX = 'casf:';
export const CASF_HOME_TAB = 'casf:home';

const STORAGE_KEY = 'objectiv-casf-v1';

export type CasfMemberRole = 'owner' | 'editor' | 'viewer';

export type CasfMember = {
  id: string;
  displayName: string;
  color: string;
  role: CasfMemberRole;
  /** True when this row is the local user. */
  self?: boolean;
};

export type CasfTeam = {
  id: string;
  name: string;
  orgId: string;
  inviteCode: string;
  members: CasfMember[];
  createdAt: string;
};

export type CasfSessionLayout = {
  /** Two peer screenshare slots + self editor. */
  leftPeerId: string | null;
  rightPeerId: string | null;
};

export type CasfState = {
  teams: CasfTeam[];
  activeTeamId: string | null;
  layout: CasfSessionLayout;
  /** Mock shared buffer for attribution demo. */
  sharedCode: string;
  /** Line → memberId of last edit (1-based). */
  lineAuthors: Record<number, string>;
};

const MEMBER_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb7185'];

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function inviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function isCasfTab(path: string): boolean {
  return path === CASF_HOME_TAB || path.startsWith(CASF_TAB_PREFIX);
}

export function defaultCasfState(displayName: string, orgId: string): CasfState {
  const selfId = uid('me');
  const peerA = uid('m');
  const peerB = uid('m');
  const teamId = uid('team');
  return {
    teams: [
      {
        id: teamId,
        name: orgId ? `${orgId} CASF` : 'Demo team',
        orgId: orgId || 'local',
        inviteCode: inviteCode(),
        createdAt: new Date().toISOString(),
        members: [
          {
            id: selfId,
            displayName: displayName.trim() || 'You',
            color: MEMBER_COLORS[0],
            role: 'owner',
            self: true,
          },
          {
            id: peerA,
            displayName: 'Alex (demo)',
            color: MEMBER_COLORS[1],
            role: 'editor',
          },
          {
            id: peerB,
            displayName: 'Sam (demo)',
            color: MEMBER_COLORS[2],
            role: 'editor',
          },
        ],
      },
    ],
    activeTeamId: teamId,
    layout: { leftPeerId: peerA, rightPeerId: peerB },
    sharedCode: `// CASF — Code as a Friend\n// Live team buffer (MVP: local mock; sync comes next)\n\nexport function greet(name: string) {\n  return \`Hello, \${name}\`;\n}\n`,
    lineAuthors: { 4: peerA, 5: peerB },
  };
}

export function loadCasfState(displayName: string, orgId: string): CasfState {
  if (typeof localStorage === 'undefined') return defaultCasfState(displayName, orgId);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCasfState(displayName, orgId);
    const parsed = JSON.parse(raw) as CasfState;
    if (!parsed?.teams?.length) return defaultCasfState(displayName, orgId);
    return parsed;
  } catch {
    return defaultCasfState(displayName, orgId);
  }
}

export function saveCasfState(state: CasfState): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getActiveTeam(state: CasfState): CasfTeam | null {
  return state.teams.find((t) => t.id === state.activeTeamId) ?? state.teams[0] ?? null;
}

export function createCasfTeam(
  state: CasfState,
  name: string,
  orgId: string,
  displayName: string,
): CasfState {
  const selfId = uid('me');
  const team: CasfTeam = {
    id: uid('team'),
    name: name.trim() || 'New team',
    orgId: orgId.trim() || 'org',
    inviteCode: inviteCode(),
    createdAt: new Date().toISOString(),
    members: [
      {
        id: selfId,
        displayName: displayName.trim() || 'You',
        color: MEMBER_COLORS[state.teams.length % MEMBER_COLORS.length],
        role: 'owner',
        self: true,
      },
    ],
  };
  return {
    ...state,
    teams: [...state.teams, team],
    activeTeamId: team.id,
    layout: { leftPeerId: null, rightPeerId: null },
  };
}

export function memberById(team: CasfTeam | null, id: string | null): CasfMember | null {
  if (!team || !id) return null;
  return team.members.find((m) => m.id === id) ?? null;
}

/** Apply a local edit and stamp the current user on touched lines. */
export function applySelfEdit(
  state: CasfState,
  nextCode: string,
  selfId: string,
): CasfState {
  const prevLines = state.sharedCode.split('\n');
  const nextLines = nextCode.split('\n');
  const authors = { ...state.lineAuthors };
  const max = Math.max(prevLines.length, nextLines.length);
  for (let i = 0; i < max; i++) {
    if (prevLines[i] !== nextLines[i]) {
      authors[i + 1] = selfId;
    }
  }
  // Drop authors past EOF
  for (const key of Object.keys(authors)) {
    const line = Number(key);
    if (line > nextLines.length) delete authors[line];
  }
  return { ...state, sharedCode: nextCode, lineAuthors: authors };
}
