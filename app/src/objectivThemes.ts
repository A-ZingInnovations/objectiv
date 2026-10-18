export type ThemeBase = 'dark' | 'light';

export const WORKBENCH_COLOR_THEME_IDS = [
  'dark-plus',
  'light-plus',
  'objectiv-teal',
  'objectiv-ocean',
  'objectiv-ember',
  'objectiv-violet',
  'objectiv-graphite',
] as const;

export type WorkbenchColorThemeId = (typeof WORKBENCH_COLOR_THEME_IDS)[number];

export const WORKBENCH_COLOR_THEME_LABELS: Record<WorkbenchColorThemeId, string> = {
  'dark-plus': 'Dark+',
  'light-plus': 'Light+',
  'objectiv-teal': 'Objectiv Teal',
  'objectiv-ocean': 'Objectiv Ocean',
  'objectiv-ember': 'Objectiv Ember',
  'objectiv-violet': 'Objectiv Violet',
  'objectiv-graphite': 'Objectiv Graphite',
};

export const ACCENT_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: 'default', label: 'Theme default', hex: '' },
  { id: 'teal', label: 'Teal', hex: '#2dd4bf' },
  { id: 'blue', label: 'Blue', hex: '#007acc' },
  { id: 'sky', label: 'Sky', hex: '#38bdf8' },
  { id: 'violet', label: 'Violet', hex: '#a78bfa' },
  { id: 'ember', label: 'Ember', hex: '#fb923c' },
  { id: 'rose', label: 'Rose', hex: '#fb7185' },
  { id: 'lime', label: 'Lime', hex: '#a3e635' },
];

/** CSS custom properties controlled by workbench color themes. */
export const THEME_CSS_VARS = [
  '--activity-bar-bg',
  '--activity-bar-fg',
  '--activity-bar-inactive-fg',
  '--activity-bar-active-fg',
  '--activity-bar-badge-bg',
  '--activity-bar-active-border',
  '--side-bar-bg',
  '--side-bar-fg',
  '--side-bar-title-fg',
  '--side-bar-border',
  '--editor-bg',
  '--editor-fg',
  '--title-bar-bg',
  '--title-bar-fg',
  '--tab-inactive-bg',
  '--tab-inactive-fg',
  '--tab-active-bg',
  '--tab-active-fg',
  '--tab-border',
  '--tab-hover-bg',
  '--list-hover-bg',
  '--list-active-bg',
  '--list-active-fg',
  '--list-focus-bg',
  '--input-bg',
  '--input-border',
  '--input-fg',
  '--button-bg',
  '--button-hover-bg',
  '--button-secondary-bg',
  '--status-bar-bg',
  '--status-bar-fg',
  '--panel-bg',
  '--panel-border',
  '--focus-border',
  '--objectiv-accent',
  '--objectiv-accent-text',
] as const;

type ThemeVars = Partial<Record<(typeof THEME_CSS_VARS)[number], string>>;

type Preset = {
  id: WorkbenchColorThemeId;
  base: ThemeBase;
  accentDefault: string;
  vars: ThemeVars;
};

const DARK_PLUS: ThemeVars = {
  '--activity-bar-bg': '#333333',
  '--activity-bar-fg': 'rgba(255, 255, 255, 0.4)',
  '--activity-bar-inactive-fg': 'rgba(255, 255, 255, 0.4)',
  '--activity-bar-active-fg': '#ffffff',
  '--activity-bar-badge-bg': '#007acc',
  '--activity-bar-active-border': '#ffffff',
  '--side-bar-bg': '#252526',
  '--side-bar-fg': '#cccccc',
  '--side-bar-title-fg': '#bbbbbb',
  '--side-bar-border': '#2b2b2b',
  '--editor-bg': '#1e1e1e',
  '--editor-fg': '#d4d4d4',
  '--title-bar-bg': '#3c3c3c',
  '--title-bar-fg': '#cccccc',
  '--tab-inactive-bg': '#2d2d2d',
  '--tab-inactive-fg': '#ffffff80',
  '--tab-active-bg': '#1e1e1e',
  '--tab-active-fg': '#ffffff',
  '--tab-border': '#252526',
  '--tab-hover-bg': '#2a2a2a',
  '--list-hover-bg': '#2a2d2e',
  '--list-active-bg': '#04395e',
  '--list-active-fg': '#ffffff',
  '--list-focus-bg': '#094771',
  '--input-bg': '#3c3c3c',
  '--input-border': '#3c3c3c',
  '--input-fg': '#cccccc',
  '--button-bg': '#0e639c',
  '--button-hover-bg': '#1177bb',
  '--button-secondary-bg': '#3a3d41',
  '--status-bar-bg': '#181818',
  '--status-bar-fg': '#ffffff',
  '--panel-bg': '#1e1e1e',
  '--panel-border': '#2b2b2b',
  '--focus-border': '#007fd4',
};

const LIGHT_PLUS: ThemeVars = {
  '--activity-bar-bg': '#2c2c2c',
  '--activity-bar-fg': 'rgba(255, 255, 255, 0.4)',
  '--activity-bar-inactive-fg': 'rgba(255, 255, 255, 0.4)',
  '--activity-bar-active-fg': '#ffffff',
  '--activity-bar-active-border': '#ffffff',
  '--side-bar-bg': '#f3f3f3',
  '--side-bar-fg': '#3b3b3b',
  '--side-bar-title-fg': '#6f6f6f',
  '--side-bar-border': '#e5e5e5',
  '--editor-bg': '#ffffff',
  '--editor-fg': '#3b3b3b',
  '--title-bar-bg': '#dddddd',
  '--title-bar-fg': '#333333',
  '--tab-inactive-bg': '#ececec',
  '--tab-inactive-fg': '#6f6f6f',
  '--tab-active-bg': '#ffffff',
  '--tab-active-fg': '#3b3b3b',
  '--tab-border': '#f3f3f3',
  '--tab-hover-bg': '#e8e8e8',
  '--list-hover-bg': '#e8e8e8',
  '--list-active-bg': '#0060c0',
  '--list-active-fg': '#ffffff',
  '--list-focus-bg': '#0060c0',
  '--input-bg': '#ffffff',
  '--input-border': '#cecece',
  '--input-fg': '#3b3b3b',
  '--button-bg': '#007acc',
  '--button-hover-bg': '#006bb3',
  '--button-secondary-bg': '#e5e5e5',
  '--status-bar-bg': '#181818',
  '--status-bar-fg': '#ffffff',
  '--panel-bg': '#ffffff',
  '--panel-border': '#e5e5e5',
  '--focus-border': '#0090f1',
};

const PRESETS: Preset[] = [
  { id: 'dark-plus', base: 'dark', accentDefault: '#007acc', vars: { ...DARK_PLUS } },
  { id: 'light-plus', base: 'light', accentDefault: '#007acc', vars: { ...LIGHT_PLUS } },
  {
    id: 'objectiv-teal',
    base: 'dark',
    accentDefault: '#2dd4bf',
    vars: {
      ...DARK_PLUS,
      '--side-bar-bg': '#1a2224',
      '--side-bar-border': '#243033',
      '--editor-bg': '#141a1b',
      '--tab-active-bg': '#141a1b',
      '--tab-inactive-bg': '#1c2426',
      '--title-bar-bg': '#1c2426',
      '--panel-bg': '#141a1b',
    },
  },
  {
    id: 'objectiv-ocean',
    base: 'dark',
    accentDefault: '#38bdf8',
    vars: {
      ...DARK_PLUS,
      '--side-bar-bg': '#1a2028',
      '--editor-bg': '#141820',
      '--tab-active-bg': '#141820',
      '--tab-inactive-bg': '#1c2430',
      '--title-bar-bg': '#1c2430',
    },
  },
  {
    id: 'objectiv-ember',
    base: 'dark',
    accentDefault: '#fb923c',
    vars: {
      ...DARK_PLUS,
      '--side-bar-bg': '#242018',
      '--editor-bg': '#1a1612',
      '--tab-active-bg': '#1a1612',
      '--tab-inactive-bg': '#242018',
      '--title-bar-bg': '#2a241e',
    },
  },
  {
    id: 'objectiv-violet',
    base: 'dark',
    accentDefault: '#a78bfa',
    vars: {
      ...DARK_PLUS,
      '--side-bar-bg': '#1e1a28',
      '--editor-bg': '#16121f',
      '--tab-active-bg': '#16121f',
      '--tab-inactive-bg': '#221c30',
      '--title-bar-bg': '#221c30',
    },
  },
  {
    id: 'objectiv-graphite',
    base: 'dark',
    accentDefault: '#94a3b8',
    vars: {
      ...DARK_PLUS,
      '--side-bar-bg': '#222326',
      '--editor-bg': '#18191c',
      '--tab-active-bg': '#18191c',
      '--activity-bar-bg': '#2a2b30',
      '--title-bar-bg': '#2a2b30',
    },
  },
];

const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export function isWorkbenchColorThemeId(value: string): value is WorkbenchColorThemeId {
  return (WORKBENCH_COLOR_THEME_IDS as readonly string[]).includes(value);
}

export function themeBaseKind(id: WorkbenchColorThemeId): ThemeBase {
  return PRESET_BY_ID.get(id)?.base ?? 'dark';
}

export function resolveWorkbenchColorTheme(
  id: unknown,
  legacyTheme: unknown,
): WorkbenchColorThemeId {
  if (typeof id === 'string' && isWorkbenchColorThemeId(id)) return id;
  return legacyTheme === 'light' ? 'light-plus' : 'dark-plus';
}

export function normalizeAccentHex(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const hex = t.startsWith('#') ? t.slice(1) : t;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeAccentHex(hex);
  if (!n) return null;
  const h = n.slice(1);
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixHex(a: string, b: string, weightB: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const w = Math.min(1, Math.max(0, weightB));
  return toHex(
    pa.r * (1 - w) + pb.r * w,
    pa.g * (1 - w) + pb.g * w,
    pa.b * (1 - w) + pb.b * w,
  );
}

function shadeHex(hex: string, amount: number): string {
  const p = parseHex(hex);
  if (!p) return hex;
  if (amount >= 0) {
    return toHex(p.r + (255 - p.r) * amount, p.g + (255 - p.g) * amount, p.b + (255 - p.b) * amount);
  }
  const f = 1 + amount;
  return toHex(p.r * f, p.g * f, p.b * f);
}

function contrastTextOn(accent: string): string {
  const p = parseHex(accent);
  if (!p) return '#ffffff';
  const lum = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255;
  return lum > 0.62 ? '#1a1a1a' : '#ffffff';
}

function accentVariableOverrides(accent: string, base: ThemeBase): ThemeVars {
  const onDark = base === 'dark';
  return {
    '--objectiv-accent': accent,
    '--objectiv-accent-text': contrastTextOn(accent),
    '--focus-border': accent,
    '--activity-bar-badge-bg': accent,
    '--button-bg': shadeHex(accent, onDark ? -0.14 : -0.1),
    '--button-hover-bg': shadeHex(accent, onDark ? 0.06 : 0.08),
    '--list-active-bg': mixHex(accent, onDark ? '#000000' : '#ffffff', onDark ? 0.78 : 0.82),
    '--list-focus-bg': mixHex(accent, onDark ? '#000000' : '#ffffff', onDark ? 0.68 : 0.72),
  };
}

export function buildThemeCssVariables(
  themeId: WorkbenchColorThemeId,
  accentOverride: string,
): ThemeVars {
  const preset = PRESET_BY_ID.get(themeId) ?? PRESET_BY_ID.get('dark-plus')!;
  const accent = normalizeAccentHex(accentOverride) ?? preset.accentDefault;
  return {
    ...preset.vars,
    ...accentVariableOverrides(accent, preset.base),
  };
}

export function applyWorkbenchAppearance(settings: {
  workbenchColorTheme: WorkbenchColorThemeId;
  accentColor: string;
}): void {
  const preset = PRESET_BY_ID.get(settings.workbenchColorTheme) ?? PRESET_BY_ID.get('dark-plus')!;
  const vars = buildThemeCssVariables(settings.workbenchColorTheme, settings.accentColor);
  const root = document.documentElement;
  root.dataset.objectivTheme = preset.base;
  root.dataset.objectivColorTheme = settings.workbenchColorTheme;

  for (const key of THEME_CSS_VARS) {
    const value = vars[key];
    if (value) root.style.setProperty(key, value);
    else root.style.removeProperty(key);
  }
}
