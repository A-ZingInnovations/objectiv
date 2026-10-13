import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isTauriDesktop, searchWorkspace } from '../desktopWorkspace';
import { parseSearchHitLine, type ParsedSearchHit } from '../searchParse';
import { loadSearchPrefs, saveSearchPrefs, type SearchPrefs } from '../searchPrefs';
import {
  groupSearchHits,
  highlightSearchPreview,
  formatSearchPreview,
} from '../searchResultsUi';
import FileTypeIcon from './FileTypeIcon';
import SideBarSection from './SideBarSection';

type Props = {
  workspaceRoot: string | null;
  workspaceFileRels?: string[];
  scopeFolder?: string | null;
  onQuickOpen?: () => void;
  onOpenMatch: (rel: string, line?: number) => void;
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

function fuzzyMatchFile(query: string, path: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const p = path.toLowerCase();
  if (p.includes(q)) return true;
  let i = 0;
  for (const ch of p) {
    if (ch === q[i]) i += 1;
    if (i >= q.length) return true;
  }
  return false;
}

export default function SearchPanel({
  workspaceRoot,
  workspaceFileRels = [],
  scopeFolder,
  onQuickOpen,
  onOpenMatch,
}: Props) {
  const [query, setQuery] = useState('');
  const [fileQuery, setFileQuery] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [fileSearchOpen, setFileSearchOpen] = useState(false);
  const [textSearchOpen, setTextSearchOpen] = useState(false);
  const [prefs, setPrefs] = useState<SearchPrefs>(() => loadSearchPrefs());
  const [showFilters, setShowFilters] = useState(
    () =>
      Boolean(prefs.include.trim() || prefs.exclude.trim() || prefs.folder.trim()) ||
      Boolean(scopeFolder),
  );
  const [results, setResults] = useState<ParsedSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());
  const [activeHitKey, setActiveHitKey] = useState<string | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  /** Ignore stale `workspace_search` responses when the user types ahead. */
  const searchGenerationRef = useRef(0);

  const groups = useMemo(() => groupSearchHits(results), [results]);

  const highlightOpts = useMemo(
    () => ({
      query: query.trim(),
      matchCase: prefs.matchCase,
      useRegex: prefs.useRegex,
      wholeWord: prefs.wholeWord,
    }),
    [query, prefs.matchCase, prefs.useRegex, prefs.wholeWord],
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
    if (!isTauriDesktop()) {
      setError('Search requires the Objectiv desktop app.');
      return;
    }
    const generation = ++searchGenerationRef.current;
    const p = prefsRef.current;
    setBusy(true);
    setError(null);
    setSearched(true);
    try {
      const lines = await searchWorkspace(workspaceRoot, {
        pattern: q,
        include: p.include.trim() || undefined,
        exclude: p.exclude.trim() || undefined,
        folder: p.folder.trim() || undefined,
        regex: p.useRegex,
        matchCase: p.matchCase,
        wholeWord: p.wholeWord,
      });
      if (generation !== searchGenerationRef.current) return;

      const parsed = lines
        .map((line) => parseSearchHitLine(line, workspaceRoot))
        .filter((h): h is ParsedSearchHit => h !== null);
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
  }, [query, workspaceRoot]);

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

  const allCollapsed =
    groups.length > 0 && groups.every((g) => collapsedFiles.has(g.rel));
  const allExpanded = collapsedFiles.size === 0;

  const fileHits = useMemo(() => {
    const list = workspaceFileRels.filter((rel) => fuzzyMatchFile(fileQuery, rel));
    return list.slice(0, 40);
  }, [workspaceFileRels, fileQuery]);

  return (
    <>
      <div className="side-bar-title">SEARCH</div>
      <div className="search-panel side-bar-scroll">
        <SideBarSection
          title="Quick Open"
          open={quickOpen}
          onToggle={() => setQuickOpen((v) => !v)}
        >
          <button
            type="button"
            className="run-list-btn search-quick-open-btn"
            disabled={!onQuickOpen}
            onClick={() => onQuickOpen?.()}
          >
            <span className="codicon codicon-search" aria-hidden />
            Go to file… (⌘P)
          </button>
        </SideBarSection>

        <SideBarSection
          title="File Search"
          count={fileHits.length}
          open={fileSearchOpen}
          onToggle={() => setFileSearchOpen((v) => !v)}
        >
          <input
            className="search-query-input search-file-filter"
            value={fileQuery}
            onChange={(e) => setFileQuery(e.target.value)}
            placeholder="Filter by name"
            disabled={!workspaceRoot}
          />
          {fileHits.length === 0 ? (
            <p className="sidebar-section-empty">No matching files</p>
          ) : (
            <ul className="sidebar-section-list">
              {fileHits.map((rel) => (
                <li key={rel}>
                  <button
                    type="button"
                    className="sidebar-section-item"
                    onClick={() => onOpenMatch(rel)}
                  >
                    <FileTypeIcon path={rel} className="sidebar-section-item-icon" size="sm" />
                    <span className="sidebar-section-item-label">{rel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SideBarSection>

        <SideBarSection
          title="Text Search"
          open={textSearchOpen}
          onToggle={() => setTextSearchOpen((v) => !v)}
        >
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <div className="search-query-row">
            <input
              className="search-query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              disabled={!workspaceRoot}
            />
            <button
              type="submit"
              className="search-run-btn"
              disabled={!query.trim() || !workspaceRoot}
              title="Search"
            >
              <span className="codicon codicon-search" aria-hidden />
            </button>
          </div>

          <div className="search-toggle-row">
            <Toggle
              active={prefs.matchCase}
              title="Match case"
              label="Aa"
              disabled={!workspaceRoot}
              onClick={() => {
                patchPrefs({ matchCase: !prefs.matchCase });
              }}
            />
            <Toggle
              active={prefs.wholeWord}
              title="Match whole word"
              label="ab"
              disabled={!workspaceRoot}
              onClick={() => patchPrefs({ wholeWord: !prefs.wholeWord })}
            />
            <Toggle
              active={prefs.useRegex}
              title="Use regular expression"
              label=".*"
              disabled={!workspaceRoot}
              onClick={() => patchPrefs({ useRegex: !prefs.useRegex })}
            />
            <button
              type="button"
              className={`search-toggle search-filter-toggle ${showFilters ? 'active' : ''}`}
              title="Toggle search filters"
              aria-expanded={showFilters}
              disabled={!workspaceRoot}
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
                  placeholder="e.g. *.ts, *.tsx"
                  disabled={!workspaceRoot}
                />
              </label>
              <label className="search-field">
                <span className="search-field-label">files to exclude</span>
                <input
                  value={prefs.exclude}
                  onChange={(e) => patchPrefs({ exclude: e.target.value })}
                  placeholder="e.g. node_modules, dist, *.min.js"
                  disabled={!workspaceRoot}
                />
              </label>
              <label className="search-field">
                <span className="search-field-label">folder</span>
                <input
                  value={prefs.folder}
                  onChange={(e) => patchPrefs({ folder: e.target.value })}
                  placeholder="Relative path, e.g. src/components"
                  disabled={!workspaceRoot}
                />
              </label>
            </div>
          )}
        </form>

        <div className="search-results-pane">
          {!workspaceRoot && <p className="side-bar-placeholder-hint">Open folder…</p>}
          {!isTauriDesktop() && workspaceRoot && (
            <p className="side-bar-placeholder-hint">Search requires the Objectiv desktop app.</p>
          )}
          {error && (
            <div className="search-empty-state search-empty-error" role="alert">
              <span className="codicon codicon-error" aria-hidden />
              <p>{error}</p>
            </div>
          )}
          {busy && results.length === 0 && (
            <div className="search-busy" aria-live="polite">
              <div className="search-busy-bar" />
              <p className="search-empty-state">
                <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden />
                Searching…
              </p>
            </div>
          )}
          {searched && !busy && !error && results.length === 0 && query.trim() && workspaceRoot && (
            <div className="search-empty-state">
              <span className="codicon codicon-search" aria-hidden />
              <p>No results for “{query.trim()}”</p>
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
        </SideBarSection>
      </div>
    </>
  );
}
