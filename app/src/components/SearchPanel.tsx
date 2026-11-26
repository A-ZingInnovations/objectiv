import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { readWorkspaceFile, searchWorkspace } from '../desktopWorkspace';
import { parseSearchHitLine, parseSearchTerms, type ParsedSearchHit } from '../searchParse';
import { loadSearchPrefs, saveSearchPrefs, type SearchPrefs } from '../searchPrefs';
import {
  groupSearchHits,
  highlightSearchPreview,
  formatSearchPreview,
} from '../searchResultsUi';
import { replaceAllInWorkspaceFiles, replaceInText } from '../workspaceSearchReplace';
import { useIsElectronDesktop } from '../useIsElectronDesktop';
import FileTypeIcon from './FileTypeIcon';
import SideBarOpenFolderHint from './SideBarOpenFolderHint';

type Props = {
  workspaceRoot: string | null;
  workspaceFileRels?: string[];
  scopeFolder?: string | null;
  onQuickOpen?: () => void;
  onOpenMatch: (rel: string, line?: number) => void;
  onOpenFolder?: () => void;
  onRefreshExplorer?: () => void;
};

function Toggle({
  active,
  title,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  title: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`search-toggle ${active ? 'active' : ''}`}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

const SHOW_REPLACE_KEY = 'objectiv-search-show-replace';

export default function SearchPanel({
  workspaceRoot,
  scopeFolder,
  onQuickOpen,
  onOpenMatch,
  onOpenFolder,
  onRefreshExplorer,
}: Props) {
  const desktop = useIsElectronDesktop();
  const [query, setQuery] = useState('');
  const [replaceQueries, setReplaceQueries] = useState<string[]>(['']);
  const [showReplace, setShowReplace] = useState(() => {
    try {
      return localStorage.getItem(SHOW_REPLACE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [prefs, setPrefs] = useState<SearchPrefs>(() => loadSearchPrefs());
  const [showFilters, setShowFilters] = useState(
    () =>
      Boolean(prefs.include.trim() || prefs.exclude.trim() || prefs.folder.trim()) ||
      Boolean(scopeFolder),
  );
  const [results, setResults] = useState<ParsedSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [replacePreview, setReplacePreview] = useState<{ rel: string; before: string; after: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());
  const [activeHitKey, setActiveHitKey] = useState<string | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const searchGenerationRef = useRef(0);

  const disabled = !workspaceRoot || !desktop;

  const groups = useMemo(() => groupSearchHits(results), [results]);

  const searchTerms = useMemo(
    () => parseSearchTerms(query, prefs.useRegex),
    [query, prefs.useRegex],
  );

  const highlightOpts = useMemo(
    () => ({
      query: query.trim(),
      terms: searchTerms.length > 1 ? searchTerms : undefined,
      matchCase: prefs.matchCase,
      useRegex: prefs.useRegex,
      wholeWord: prefs.wholeWord,
    }),
    [query, searchTerms, prefs.matchCase, prefs.useRegex, prefs.wholeWord],
  );

  useEffect(() => {
    if (scopeFolder != null && scopeFolder !== '') {
      setPrefs((p) => {
        const next = { ...p, folder: scopeFolder.replace(/\\/g, '/').replace(/\/+$/, '') };
        saveSearchPrefs(next);
        return next;
      });
      setShowFilters(true);
    }
  }, [scopeFolder]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_REPLACE_KEY, showReplace ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [showReplace]);

  const patchPrefs = useCallback((patch: Partial<SearchPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      saveSearchPrefs(next);
      return next;
    });
  }, []);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || !workspaceRoot) return;
    if (!desktop) {
      setError('Search requires the Objectiv desktop app.');
      return;
    }
    const generation = ++searchGenerationRef.current;
    const p = prefsRef.current;
    setBusy(true);
    setError(null);
    setSearched(true);
    try {
      const terms = parseSearchTerms(q, p.useRegex);
      const lines = await searchWorkspace(workspaceRoot, {
        pattern: terms[0] ?? q,
        patterns: terms.length > 1 ? terms : undefined,
        include: p.include.trim() || undefined,
        exclude: p.exclude.trim() || undefined,
        folder: p.folder.trim() || undefined,
        regex: p.useRegex,
        matchCase: p.matchCase,
        wholeWord: p.wholeWord,
      });
      if (generation !== searchGenerationRef.current) return;

      const seen = new Set<string>();
      const parsed: ParsedSearchHit[] = [];
      for (const line of lines) {
        const hit = parseSearchHitLine(line, workspaceRoot);
        if (!hit) continue;
        const dedupeKey = `${hit.rel}:${hit.line}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        parsed.push(hit);
      }
      parsed.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line);
      setResults(parsed);
      setCollapsedFiles(new Set(parsed.map((h) => h.rel)));
      setActiveHitKey(null);
      if (lines.length > 0 && parsed.length === 0) {
        setError('Could not parse search results.');
      }
    } catch (e) {
      if (generation !== searchGenerationRef.current) return;
      setResults([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (generation === searchGenerationRef.current) {
        setBusy(false);
      }
    }
  }, [query, workspaceRoot, desktop]);

  const onSearchInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (query) {
          e.preventDefault();
          setQuery('');
          setResults([]);
          setSearched(false);
          setError(null);
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void runSearch();
        return;
      }
      if (mod && e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'c') {
          e.preventDefault();
          patchPrefs({ matchCase: !prefsRef.current.matchCase });
        } else if (k === 'w') {
          e.preventDefault();
          patchPrefs({ wholeWord: !prefsRef.current.wholeWord });
        } else if (k === 'r') {
          e.preventDefault();
          patchPrefs({ useRegex: !prefsRef.current.useRegex });
        } else if (k === 'f') {
          e.preventDefault();
          setShowReplace((v) => !v);
        }
      }
    },
    [query, runSearch, patchPrefs],
  );

  useEffect(() => {
    if (!query.trim() || !workspaceRoot) return;
    const t = window.setTimeout(() => {
      void runSearch();
    }, 350);
    return () => window.clearTimeout(t);
  }, [
    prefs.matchCase,
    prefs.wholeWord,
    prefs.useRegex,
    prefs.include,
    prefs.exclude,
    prefs.folder,
    query,
    workspaceRoot,
    runSearch,
  ]);

  const toggleFile = useCallback((rel: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedFiles(new Set(groups.map((g) => g.rel)));
  }, [groups]);

  const expandAll = useCallback(() => {
    setCollapsedFiles(new Set());
  }, []);

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsedFiles.has(g.rel));
  const allExpanded = collapsedFiles.size === 0;

  const generateReplacePreview = useCallback(async () => {
    if (!workspaceRoot || !query.trim() || results.length === 0) return;
    setReplaceBusy(true);
    setError(null);
    try {
      const preview: { rel: string; before: string; after: string }[] = [];
      for (const hit of results) {
        const before = await readWorkspaceFile(workspaceRoot, hit.rel);
        const after = replaceInText(before, {
          query,
          replacements: replaceQueries.map((q) => q),
          replacement: replaceQueries[0] ?? '',
          matchCase: prefs.matchCase,
          wholeWord: prefs.wholeWord,
          useRegex: prefs.useRegex,
        });
        if (after !== before) {
          preview.push({ rel: hit.rel, before, after });
        }
      }
      setReplacePreview(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReplaceBusy(false);
    }
  }, [workspaceRoot, query, replaceQueries, results, prefs]);

  const replaceAll = useCallback(async () => {
    if (!workspaceRoot || !query.trim() || results.length === 0) return;
    setReplaceBusy(true);
    setError(null);
    try {
      const { filesChanged } = await replaceAllInWorkspaceFiles(
        workspaceRoot,
        results.map((r) => r.rel),
        {
          query,
          replacements: replaceQueries.map((q) => q),
          replacement: replaceQueries[0] ?? '',
          matchCase: prefs.matchCase,
          wholeWord: prefs.wholeWord,
          useRegex: prefs.useRegex,
        },
      );
      onRefreshExplorer?.();
      setReplacePreview(null);
      await runSearch();
      if (filesChanged === 0) {
        setError('No matches were replaced in the result set.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReplaceBusy(false);
    }
  }, [
    workspaceRoot,
    query,
    replaceQueries,
    results,
    prefs,
    onRefreshExplorer,
    runSearch,
  ]);

  return (
    <>
      <div className="side-bar-title">SEARCH</div>
      <div className="search-panel">
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <div className="search-editor-widget">
            <div className="search-widget-row">
              <span className="codicon codicon-search search-widget-glyph" aria-hidden />
              <input
                className="search-query-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchInputKeyDown}
                placeholder="Search"
                title="Search (Enter to search, ⌥⌘C case, ⌥⌘W word, ⌥⌘R regex)"
                disabled={disabled}
                autoFocus
              />
              <button
                type="button"
                className="search-widget-icon-btn"
                title={showReplace ? 'Hide replace field' : 'Show replace field'}
                aria-expanded={showReplace}
                disabled={disabled}
                onClick={() => setShowReplace((v) => !v)}
              >
                <span
                  className={`codicon ${showReplace ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
                  aria-hidden
                />
              </button>
            </div>
            {showReplace && (
              <>
                <div className="search-widget-row search-widget-row-replace">
                  <span className="codicon codicon-replace search-widget-glyph" aria-hidden />
                  <span className="search-replace-label">Replace {searchTerms.length > 1 ? '(by index)' : ''}</span>
                </div>
                {searchTerms.map((term, i) => (
                  <div key={i} className="search-widget-row search-widget-row-replace">
                    <span className="codicon codicon-replace search-widget-glyph" aria-hidden />
                    <input
                      className="search-query-input"
                      value={replaceQueries[i] ?? ''}
                      onChange={(e) =>
                        setReplaceQueries((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      placeholder={`Replace “${term}” with…`}
                      title={`Replace ${term}`}
                      disabled={disabled}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="search-widget-icon-btn"
                  title="Add replace field"
                  disabled={disabled || searchTerms.length <= 1}
                  onClick={() =>
                    setReplaceQueries((prev) => [...prev, ''])
                  }
                >
                  <span className="codicon codicon-add" aria-hidden />
                </button>
                <button
                  type="button"
                  className="search-widget-icon-btn"
                  title="Preview Replace"
                  disabled={disabled || !results.length || replaceBusy}
                  onClick={() => void generateReplacePreview()}
                >
                  <span className="codicon codicon-eye" aria-hidden />
                </button>
              </>
            )}
          </div>

          <div className="search-toggle-row">
            <Toggle
              active={prefs.matchCase}
              title="Match Case"
              label="Aa"
              disabled={disabled}
              onClick={() => patchPrefs({ matchCase: !prefs.matchCase })}
            />
            <Toggle
              active={prefs.wholeWord}
              title="Match Whole Word"
              label="ab"
              disabled={disabled}
              onClick={() => patchPrefs({ wholeWord: !prefs.wholeWord })}
            />
            <Toggle
              active={prefs.useRegex}
              title="Use Regular Expression"
              label=".*"
              disabled={disabled}
              onClick={() => patchPrefs({ useRegex: !prefs.useRegex })}
            />
            <button
              type="button"
              className={`search-toggle search-filter-toggle ${showFilters ? 'active' : ''}`}
              title="Toggle search details"
              aria-expanded={showFilters}
              disabled={disabled}
              onClick={() => setShowFilters((v) => !v)}
            >
              <span className="codicon codicon-filter" aria-hidden />
            </button>
          </div>

          {showFilters && (
            <div className="search-filters">
              <label className="search-field">
                <span className="search-field-label">files to include</span>
                <input
                  value={prefs.include}
                  onChange={(e) => patchPrefs({ include: e.target.value })}
                  placeholder="e.g. *.ts, src/**"
                  disabled={disabled}
                />
              </label>
              <label className="search-field">
                <span className="search-field-label">files to exclude</span>
                <input
                  value={prefs.exclude}
                  onChange={(e) => patchPrefs({ exclude: e.target.value })}
                  placeholder="e.g. node_modules, dist"
                  disabled={disabled}
                />
              </label>
              <label className="search-field">
                <span className="search-field-label">folder</span>
                <input
                  value={prefs.folder}
                  onChange={(e) => patchPrefs({ folder: e.target.value })}
                  placeholder="Relative path, e.g. src"
                  disabled={disabled}
                />
              </label>
            </div>
          )}

          {showReplace && workspaceRoot && (
            <div className="search-replace-actions">
              <button
                type="button"
                className="search-replace-btn"
                disabled={disabled || !results.length || replaceBusy || busy}
                title="Replace all matches in files with search results"
                onClick={() => void replaceAll()}
              >
                {replaceBusy ? 'Replacing…' : 'Replace All'}
              </button>
              {replacePreview && replacePreview.length > 0 && (
                <div className="search-replace-preview">
                  <div className="search-replace-preview-header">
                    <span>Preview ({replacePreview.length} file{replacePreview.length === 1 ? '' : 's'} changed)</span>
                    <button
                      type="button"
                      className="search-replace-preview-close"
                      title="Close preview"
                      onClick={() => setReplacePreview(null)}
                    >
                      <span className="codicon codicon-close" aria-hidden />
                    </button>
                  </div>
                  <ul className="search-replace-preview-list">
                    {replacePreview.map((p) => (
                      <li key={p.rel} className="search-replace-preview-item">
                        <div className="search-replace-preview-file">{p.rel}</div>
                        <div className="search-replace-preview-diff">
                          <div className="search-replace-preview-side">
                            <span className="search-replace-preview-label">Before</span>
                            <pre className="search-replace-preview-before">{p.before}</pre>
                          </div>
                          <div className="search-replace-preview-side">
                            <span className="search-replace-preview-label">After</span>
                            <pre className="search-replace-preview-after">{p.after}</pre>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="search-go-to-file"
            disabled={!onQuickOpen}
            title={onQuickOpen ? 'Quick Open' : undefined}
            onClick={() => onQuickOpen?.()}
          >
            Go to File…
            <span className="search-go-to-file-keys">⌘P</span>
          </button>
        </form>

        <div className="search-results-pane">
          {!workspaceRoot &&
            (onOpenFolder ? (
              <SideBarOpenFolderHint onOpenFolder={onOpenFolder} />
            ) : (
              <p className="side-bar-placeholder-hint">Open a folder to search.</p>
            ))}
          {!desktop && workspaceRoot && (
            <p className="side-bar-placeholder-hint">Search requires the Objectiv desktop app.</p>
          )}
          {error && (
            <div className="search-empty-state search-empty-error" role="alert">
              <span className="codicon codicon-error" aria-hidden />
              <p>{error}</p>
            </div>
          )}
          {busy && results.length === 0 && workspaceRoot && (
            <div className="search-busy" aria-live="polite">
              <div className="search-busy-bar" />
              <p className="search-empty-state">
                <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden />
                Searching…
              </p>
            </div>
          )}
          {searched &&
            !busy &&
            !error &&
            results.length === 0 &&
            query.trim() &&
            workspaceRoot && (
              <div className="search-empty-state">
                <span className="codicon codicon-search" aria-hidden />
                <p>
                  No results for{' '}
                  {searchTerms.length > 1
                    ? searchTerms.map((t) => `“${t}”`).join(', ')
                    : `“${query.trim()}”`}
                </p>
              </div>
            )}

          {results.length > 0 && (
            <>
              {busy && <div className="search-busy-bar search-busy-bar-inline" aria-hidden />}
              <div className="search-summary-row">
                <div className="search-summary">
                  <span className="search-summary-count">{results.length}</span>
                  <span className="search-summary-label">
                    {results.length === 1 ? 'result' : 'results'}
                  </span>
                  <span className="search-summary-sep">·</span>
                  <span className="search-summary-count">{groups.length}</span>
                  <span className="search-summary-label">
                    {groups.length === 1 ? 'file' : 'files'}
                  </span>
                  {busy && (
                    <span className="search-summary-updating">
                      <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden />
                      Updating…
                    </span>
                  )}
                </div>
                <div className="search-summary-actions">
                  <button
                    type="button"
                    className="search-summary-action"
                    title="Expand all"
                    aria-label="Expand all"
                    disabled={allExpanded}
                    onClick={expandAll}
                  >
                    <span className="codicon codicon-expand-all" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="search-summary-action"
                    title="Collapse all"
                    aria-label="Collapse all"
                    disabled={allCollapsed}
                    onClick={collapseAll}
                  >
                    <span className="codicon codicon-collapse-all" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="search-results-tree" role="tree" aria-label="Search results">
                {groups.map((group) => {
                  const collapsed = collapsedFiles.has(group.rel);
                  return (
                    <div
                      key={group.rel}
                      className={`search-file-group ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
                      role="treeitem"
                      aria-expanded={!collapsed}
                    >
                      <button
                        type="button"
                        className="search-file-header"
                        onClick={() => toggleFile(group.rel)}
                        title={group.rel}
                      >
                        <span
                          className={`search-file-chevron codicon ${collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'}`}
                          aria-hidden
                        />
                        <FileTypeIcon path={group.rel} className="search-file-icon" size="sm" />
                        <span className="search-file-meta">
                          <span className="search-file-title-row">
                            <span className="search-file-name">{group.basename}</span>
                            <span className="search-file-badge">{group.hits.length}</span>
                          </span>
                          <span className="search-file-path">{group.rel}</span>
                        </span>
                      </button>

                      {!collapsed && (
                        <>
                          <div className="search-match-columns" aria-hidden>
                            <span className="search-match-col-line">Line</span>
                            <span className="search-match-col-text">Match</span>
                          </div>
                          <ul className="search-file-matches">
                            {group.hits.map((hit) => {
                              const preview = formatSearchPreview(hit.preview);
                              const isActive = activeHitKey === hit.key;
                              return (
                                <li key={hit.key}>
                                  <button
                                    type="button"
                                    className={`search-match-row ${isActive ? 'is-active' : ''}`}
                                    aria-current={isActive ? 'true' : undefined}
                                    aria-label={`Line ${hit.line}, ${group.basename}`}
                                    onClick={() => {
                                      setActiveHitKey(hit.key);
                                      onOpenMatch(hit.rel, hit.line);
                                    }}
                                    title={`${hit.rel}:${hit.line}`}
                                  >
                                    <span className="search-line-mark" title={`Line ${hit.line}`}>
                                      <span
                                        className="codicon codicon-debug-line-by-line search-line-mark-icon"
                                        aria-hidden
                                      />
                                      <span className="search-line-mark-num">{hit.line}</span>
                                    </span>
                                    <span className="search-match-preview">
                                      {highlightSearchPreview(preview, highlightOpts)}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}