export type SearchPrefs = {
  include: string;
  exclude: string;
  folder: string;
  useRegex: boolean;
  matchCase: boolean;
  wholeWord: boolean;
};

const KEY = 'objectiv-search-prefs-v1';

const DEFAULTS: SearchPrefs = {
  include: '',
  exclude: '',
  folder: '',
  useRegex: false,
  matchCase: false,
  wholeWord: false,
};

export function loadSearchPrefs(): SearchPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<SearchPrefs>;
    return {
      include: typeof p.include === 'string' ? p.include : DEFAULTS.include,
      exclude: typeof p.exclude === 'string' ? p.exclude : DEFAULTS.exclude,
      folder: typeof p.folder === 'string' ? p.folder : DEFAULTS.folder,
      useRegex: Boolean(p.useRegex),
      matchCase: Boolean(p.matchCase),
      wholeWord: Boolean(p.wholeWord),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSearchPrefs(prefs: SearchPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
