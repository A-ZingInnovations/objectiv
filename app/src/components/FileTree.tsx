import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import ExplorerWelcome from './ExplorerWelcome';
import { displayPath, encodeDiskPath, parseDiskPath } from '../workspaceDisk';
import { workspaceFolderLabel } from '../desktopWorkspace';
import { explorerPathIsDir, invalidExplorerDrop } from '../explorerDnd';
import FileTypeIcon from './FileTypeIcon';

type ExplorerActions = {
  onOpenFile: (path: string) => void;
  onOpenToSide?: (path: string) => void;
  onNewFile: () => void;
  onNewFileInDir?: (dirPath: string) => void;
  onNewFolderInDir?: (dirPath: string) => void;
  onRenamePath?: (path: string, isDir: boolean) => void;
  onDeletePath?: (path: string, isDir: boolean) => void;
  onCopyPath?: (path: string, relative: boolean) => void;
  onCutExplorerItem?: (path: string, isDir: boolean) => void;
  onCopyExplorerItem?: (path: string, isDir: boolean) => void;
  onPasteExplorerItem?: (dirPath: string) => void;
  canPasteExplorer?: boolean;
  cutExplorerPath?: string | null;
  onRevealInOs?: (path: string) => void;
  onOpenInTerminal?: (dirPath: string) => void;
  onFindInFolder?: (dirPath: string) => void;
  onOpenFolder: () => void;
  onAddFolder: () => void;
  onCloneRepository?: () => void;
  onSelectRoot: (rootIndex: number) => void;
  onCloseFolder?: (rootIndex?: number) => void;
  onRefresh: () => void;
  onDragDropPaths?: (sources: string[], destDirEncoded: string, copy: boolean) => void;
};

type Props = ExplorerActions & {
  filePaths: string[];
  workspaceRoots: string[];
  activeRootIndex: number;
  activePath: string | null;
  diskMode: boolean;
  busy: boolean;
  isRootTrusted?: (root: string) => boolean;
  /** Hide EXPLORER chrome when nested under ExplorerSidePanel. */
  embedded?: boolean;
  /** Parent renders empty state (ExplorerSidePanel composite). */
  hideEmptyWelcome?: boolean;
};

type CtxPayload =
  | { kind: 'root'; rootIndex: number }
  | { kind: 'dir'; path: string }
  | { kind: 'file'; path: string }
  | { kind: 'blank'; rootIndex: number };

type CtxTarget = CtxPayload & { x: number; y: number };

function parentDirEncoded(filePath: string): string {
  const parsed = parseDiskPath(filePath);
  if (!parsed) return '@0';
  const rel = parsed.relPath.replace(/\/+$/, '');
  const slash = rel.lastIndexOf('/');
  if (slash < 0) return encodeDiskPath(parsed.rootIndex, '');
  return encodeDiskPath(parsed.rootIndex, rel.slice(0, slash));
}

function stripTrailingSlash(p: string): string {
  return p.replace(/\/+$/, '');
}

function buildTree(encodedPaths: string[], rootIndex: number): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const fullRaw of [...encodedPaths].sort()) {
    const isDirMarker = fullRaw.endsWith('/');
    const full = stripTrailingSlash(fullRaw);
    const rel = displayPath(full);
    if (!rel) continue;
    const parts = rel.split('/').filter(Boolean);
    let cur = root;
    let acc: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const isFile = isLast && !isDirMarker;
      acc.push(name);
      const enc = encodeDiskPath(rootIndex, acc.join('/'));
      if (isFile) {
        if (!(name in cur)) {
          (cur as Record<string, unknown>)[name] = { _file: full };
        } else {
          const node = cur[name] as Record<string, unknown>;
          node._file = full;
        }
      } else {
        if (!(name in cur)) {
          (cur as Record<string, unknown>)[name] = { _dir: enc };
        } else {
          const node = cur[name] as Record<string, unknown>;
          if (!node._dir) node._dir = enc;
        }
        cur = (cur[name] as Record<string, unknown>) || {};
      }
    }
  }
  return root;
}

function getTree(paths: string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const p of paths.sort()) {
    const isDirMarker = p.endsWith('/');
    const clean = stripTrailingSlash(p);
    const parts = clean.split('/').filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const isFile = isLast && !isDirMarker;
      if (!(name in cur)) {
        (cur as Record<string, unknown>)[name] = isFile ? { _file: clean } : { _dir: parts.slice(0, i + 1).join('/') };
      }
      if (!isFile) cur = (cur[name] as Record<string, unknown>) || {};
    }
  }
  return root;
}

function menuItem(
  label: string,
  icon: string,
  onClick: () => void,
  disabled = false,
) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      <span className={`codicon codicon-${icon}`} aria-hidden />
      {label}
    </button>
  );
}

function ExplorerContextMenu({
  ctx,
  onClose,
  actions,
}: {
  ctx: CtxTarget;
  onClose: () => void;
  actions: {
    newFile: (dirPath: string) => void;
    newFolder: (dirPath: string) => void;
    open?: (path: string) => void;
    openToSide?: (path: string) => void;
    rename?: (path: string, isDir: boolean) => void;
    deletePath?: (path: string, isDir: boolean) => void;
    copyPath?: (path: string, relative: boolean) => void;
    cutItem?: (path: string, isDir: boolean) => void;
    copyItem?: (path: string, isDir: boolean) => void;
    pasteItem?: (dirPath: string) => void;
    canPaste?: boolean;
    reveal?: (path: string) => void;
    openInTerminal?: (dirPath: string) => void;
    findInFolder?: (dirPath: string) => void;
    refresh: () => void;
    closeRoot?: (rootIndex: number) => void;
  };
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const isFile = ctx.kind === 'file';
  const isDir = ctx.kind === 'dir';
  const isRootish = ctx.kind === 'root' || ctx.kind === 'blank';
  const targetPath = isFile || isDir ? ctx.path : encodeDiskPath(ctx.rootIndex, '');
  const dirPath = isDir
    ? ctx.path
    : isFile
      ? parentDirEncoded(ctx.path)
      : encodeDiskPath(ctx.rootIndex, '');

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  const left = Math.min(ctx.x, window.innerWidth - 240);
  const top = Math.min(ctx.y, window.innerHeight - 360);

  return (
    <div
      ref={ref}
      className="explorer-context-menu tab-context-menu"
      style={{ left, top }}
      role="menu"
    >
      {menuItem('New File…', 'new-file', () => run(() => actions.newFile(dirPath)))}
      {menuItem('New Folder…', 'new-folder', () => run(() => actions.newFolder(dirPath)))}

      {(isFile || isDir) && (
        <>
          <div className="menu-dropdown-sep" />
          {isFile &&
            actions.open &&
            menuItem('Open', 'go-to-file', () => run(() => actions.open!(ctx.path)))}
          {isFile &&
            actions.openToSide &&
            menuItem('Open to the Side', 'split-horizontal', () =>
              run(() => actions.openToSide!(ctx.path)),
            )}
          {actions.reveal &&
            menuItem('Reveal in Finder', 'file-directory', () =>
              run(() => actions.reveal!(targetPath)),
            )}
          {actions.openInTerminal &&
            menuItem('Open in Integrated Terminal', 'terminal', () =>
              run(() => actions.openInTerminal!(isFile ? dirPath : targetPath)),
            )}
        </>
      )}

      {isRootish && actions.reveal && (
        <>
          <div className="menu-dropdown-sep" />
          {menuItem('Reveal in Finder', 'file-directory', () =>
            run(() => actions.reveal!(targetPath)),
          )}
          {actions.openInTerminal &&
            menuItem('Open in Integrated Terminal', 'terminal', () =>
              run(() => actions.openInTerminal!(targetPath)),
            )}
        </>
      )}

      {((isFile || isDir) && (actions.cutItem || actions.copyItem)) ||
      ((isFile || isDir || isRootish) && actions.pasteItem) ? (
        <>
          <div className="menu-dropdown-sep" />
          {(isFile || isDir) &&
            actions.cutItem &&
            menuItem('Cut', 'cut', () => run(() => actions.cutItem!(targetPath, isDir)))}
          {(isFile || isDir) &&
            actions.copyItem &&
            menuItem('Copy', 'files', () => run(() => actions.copyItem!(targetPath, isDir)))}
          {(isFile || isDir || isRootish) &&
            actions.pasteItem &&
            menuItem(
              'Paste',
              'clippy',
              () => run(() => actions.pasteItem!(dirPath)),
              !actions.canPaste,
            )}
        </>
      ) : null}

      {(isFile || isDir || isRootish) && actions.copyPath && (
        <>
          <div className="menu-dropdown-sep" />
          {menuItem('Copy Path', 'copy', () => run(() => actions.copyPath!(targetPath, false)))}
          {menuItem('Copy Relative Path', 'copy', () =>
            run(() => actions.copyPath!(targetPath, true)),
          )}
        </>
      )}

      {(isFile || isDir) && (
        <>
          <div className="menu-dropdown-sep" />
          {actions.rename &&
            menuItem('Rename…', 'edit', () => run(() => actions.rename!(targetPath, isDir)))}
          {actions.deletePath &&
            menuItem('Delete…', 'trash', () => run(() => actions.deletePath!(targetPath, isDir)))}
        </>
      )}

      {(isDir || isRootish) && actions.findInFolder && (
        <>
          <div className="menu-dropdown-sep" />
          {menuItem('Find in Folder…', 'search', () =>
            run(() => actions.findInFolder!(dirPath)),
          )}
        </>
      )}

      <div className="menu-dropdown-sep" />
      {menuItem('Refresh Explorer', 'refresh', () => run(() => actions.refresh()))}

      {isRootish && actions.closeRoot && (
        <>
          <div className="menu-dropdown-sep" />
          {menuItem('Close Folder', 'close', () => run(() => actions.closeRoot!(ctx.rootIndex)))}
        </>
      )}
    </div>
  );
}

const PATHS_DRAG_TYPE = 'application/x-objectiv-paths';

function TreeEntry({
  name,
  node,
  level,
  activePath,
  cutPath,
  selectedPaths,
  dropTargetDir,
  filePaths,
  onOpenFile,
  expandSignal,
  onContextMenu,
  onSelectPath,
  onDragDropPaths,
  onDropTargetChange,
}: {
  name: string;
  node: Record<string, unknown>;
  level: number;
  activePath: string | null;
  cutPath?: string | null;
  selectedPaths: Set<string>;
  dropTargetDir: string | null;
  filePaths: string[];
  onOpenFile: (path: string) => void;
  expandSignal: number;
  onContextMenu: (e: ReactMouseEvent, target: CtxPayload) => void;
  onSelectPath: (path: string, additive: boolean) => void;
  onDragDropPaths?: (sources: string[], destDirEncoded: string, copy: boolean) => void;
  onDropTargetChange: (dir: string | null) => void;
}) {
  const path = node._file as string | undefined;
  const dirPath = node._dir as string | undefined;
  const isFile = path !== undefined && !dirPath;
  const isActive = path === activePath;
  const children = Object.entries(node).filter(([k]) => k !== '_file' && k !== '_dir');
  const hasChildren = children.length > 0;
  const isFolder = Boolean(dirPath) || hasChildren;
  const childKey = children
    .map(([k]) => k)
    .sort()
    .join('\0');
  const [open, setOpen] = useState(false);
  const prevChildKey = useRef(childKey);
  const isCut =
    Boolean(cutPath) &&
    (path === cutPath ||
      dirPath === cutPath ||
      (cutPath && dirPath && `${dirPath}/` === cutPath) ||
      (cutPath && path && path === cutPath.replace(/\/+$/, '')));

  useEffect(() => {
    if (prevChildKey.current !== childKey) {
      prevChildKey.current = childKey;
      setOpen(true);
    }
  }, [childKey, expandSignal]);

  const encoded = path ?? dirPath ?? '';
  const isSelected = encoded ? selectedPaths.has(encoded) : false;
  const isDropTarget = Boolean(dirPath && dropTargetDir === dirPath);

  const dragProps =
    onDragDropPaths && encoded
      ? {
          draggable: true as const,
          onDragStart: (e: React.DragEvent) => {
            const p = path ?? dirPath!;
            const isDir = Boolean(dirPath) || explorerPathIsDir(p, filePaths);
            let sources = [...selectedPaths];
            if (!sources.includes(p)) sources = [p];
            e.dataTransfer.setData(PATHS_DRAG_TYPE, JSON.stringify(sources));
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', displayPath(p));
            void isDir;
          },
        }
      : {};

  const folderDropProps =
    onDragDropPaths && dirPath
      ? {
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onDropTargetChange(dirPath);
            e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
          },
          onDragLeave: (e: React.DragEvent) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
              onDropTargetChange(null);
            }
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onDropTargetChange(null);
            const raw = e.dataTransfer.getData(PATHS_DRAG_TYPE);
            if (!raw) return;
            let sources: string[] = [];
            try {
              sources = JSON.parse(raw) as string[];
            } catch {
              return;
            }
            const copy = e.altKey;
            const valid = sources.filter(
              (s) => !invalidExplorerDrop(s, dirPath, explorerPathIsDir(s, filePaths)),
            );
            if (valid.length > 0) onDragDropPaths(valid, dirPath, copy);
          },
        }
      : {};

  if (isFile && !isFolder) {
    return (
      <div
        className={`file-tree-item file ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isCut ? 'cut' : ''}`}
        style={{ paddingLeft: 8 + level * 16 }}
        {...dragProps}
        onClick={(e) => {
          const additive = e.metaKey || e.ctrlKey;
          onSelectPath(path!, additive);
          if (!additive) onOpenFile(path!);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, { kind: 'file', path: path! });
        }}
      >
        <span className="chevron empty" aria-hidden />
        <FileTypeIcon path={path!} className="icon" />
        <span className="label">{name}</span>
      </div>
    );
  }

  // Folder that also has a same-named file is rare; prefer folder UI.
  return (
    <div className="file-tree-folder">
      <div
        className={`file-tree-item folder ${isCut ? 'cut' : ''} ${isSelected ? 'selected' : ''} ${isDropTarget ? 'drop-target' : ''}`}
        style={{ paddingLeft: 8 + level * 16 }}
        {...dragProps}
        {...folderDropProps}
        onClick={(e) => {
          const additive = e.metaKey || e.ctrlKey;
          if (dirPath) onSelectPath(dirPath, additive);
          if (!additive) setOpen((o) => !o);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dirPath) onContextMenu(e, { kind: 'dir', path: dirPath });
        }}
      >
        <span
          className={`chevron codicon ${open ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
          aria-hidden
        />
        <span
          className={`icon codicon ${open ? 'codicon-folder-opened' : 'codicon-folder'}`}
          aria-hidden
        />
        <span className="label">{name}</span>
      </div>
      {open &&
        children.map(([k, v]) => (
          <TreeEntry
            key={k}
            name={k}
            node={(v as Record<string, unknown>) || {}}
            level={level + 1}
            activePath={activePath}
            cutPath={cutPath}
            selectedPaths={selectedPaths}
            dropTargetDir={dropTargetDir}
            filePaths={filePaths}
            onOpenFile={onOpenFile}
            expandSignal={expandSignal}
            onContextMenu={onContextMenu}
            onSelectPath={onSelectPath}
            onDragDropPaths={onDragDropPaths}
            onDropTargetChange={onDropTargetChange}
          />
        ))}
    </div>
  );
}

function WorkspaceRootSection({
  rootIndex,
  rootPath,
  filePaths,
  activePath,
  cutPath,
  activeRoot,
  multi,
  onOpenFile,
  onSelectRoot,
  onCloseRoot,
  busy,
  onContextMenu,
  selectedPaths,
  dropTargetDir,
  onSelectPath,
  onDragDropPaths,
  onDropTargetChange,
}: {
  rootIndex: number;
  rootPath: string;
  filePaths: string[];
  activePath: string | null;
  cutPath?: string | null;
  activeRoot: boolean;
  multi: boolean;
  onOpenFile: (path: string) => void;
  onSelectRoot: () => void;
  onCloseRoot?: () => void;
  busy: boolean;
  onContextMenu: (e: ReactMouseEvent, target: CtxPayload) => void;
  selectedPaths: Set<string>;
  dropTargetDir: string | null;
  onSelectPath: (path: string, additive: boolean) => void;
  onDragDropPaths?: (sources: string[], destDirEncoded: string, copy: boolean) => void;
  onDropTargetChange: (dir: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const encodedForTree = useMemo(() => {
    return filePaths
      .filter((p) => parseDiskPath(p)?.rootIndex === rootIndex)
      .map((p) => p);
  }, [filePaths, rootIndex]);

  const tree = useMemo(
    () => buildTree(encodedForTree, rootIndex),
    [encodedForTree, rootIndex],
  );

  const expandSignal = encodedForTree.length;
  const label = workspaceFolderLabel(rootPath);

  return (
    <div
      className={`explorer-root ${activeRoot ? 'active' : ''}`}
      onContextMenu={(e) => {
        // Blank area / root chrome — only if not handled by a child
        if ((e.target as HTMLElement).closest('.file-tree-item')) return;
        e.preventDefault();
        onSelectRoot();
        onContextMenu(e, { kind: 'blank', rootIndex });
      }}
    >
      <div className="explorer-root-header">
        <button
          type="button"
          className="explorer-root-toggle"
          onClick={() => {
            onSelectRoot();
            setOpen((o) => !o);
          }}
          onDoubleClick={onSelectRoot}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectRoot();
            onContextMenu(e, { kind: 'root', rootIndex });
          }}
          aria-expanded={open}
          title={activeRoot ? rootPath : `Set active workspace · ${rootPath}`}
        >
          <span
            className={`codicon ${open ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
            aria-hidden
          />
          <span className="explorer-root-label">{label.toUpperCase()}</span>
          {activeRoot && <span className="explorer-root-badge">ACTIVE</span>}
        </button>
        {multi && onCloseRoot && (
          <button
            type="button"
            className="action explorer-root-close"
            onClick={onCloseRoot}
            title={`Close ${label}`}
            aria-label={`Close ${label}`}
            disabled={busy}
          >
            <span className="codicon codicon-close" aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div className="file-tree">
          {Object.entries(tree).map(([name, node]) => (
            <TreeEntry
              key={name}
              name={name}
              node={(node as Record<string, unknown>) || {}}
              level={0}
              activePath={activePath}
              cutPath={cutPath}
              selectedPaths={selectedPaths}
              dropTargetDir={dropTargetDir}
              filePaths={filePaths}
              onOpenFile={onOpenFile}
              expandSignal={expandSignal}
              onContextMenu={onContextMenu}
              onSelectPath={onSelectPath}
              onDragDropPaths={onDragDropPaths}
              onDropTargetChange={onDropTargetChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({
  filePaths,
  workspaceRoots,
  activeRootIndex,
  activePath,
  onOpenFile,
  onOpenToSide,
  onNewFile,
  onNewFileInDir,
  onNewFolderInDir,
  onRenamePath,
  onDeletePath,
  onCopyPath,
  onCutExplorerItem,
  onCopyExplorerItem,
  onPasteExplorerItem,
  canPasteExplorer,
  cutExplorerPath,
  onRevealInOs,
  onOpenInTerminal,
  onFindInFolder,
  onOpenFolder,
  onAddFolder,
  onCloneRepository,
  onSelectRoot,
  onCloseFolder,
  onRefresh,
  onDragDropPaths,
  diskMode,
  busy,
  isRootTrusted,
  embedded,
  hideEmptyWelcome,
}: Props) {
  const empty = workspaceRoots.length === 0;
  const demoTree = !diskMode && filePaths.length > 0 ? getTree(filePaths) : null;
  const [ctx, setCtx] = useState<CtxTarget | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [dropTargetDir, setDropTargetDir] = useState<string | null>(null);

  const onSelectPath = (path: string, additive: boolean) => {
    setSelectedPaths((prev) => {
      if (!additive) return new Set([path]);
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const activeRoot = workspaceRoots[activeRootIndex];
  const trusted = activeRoot && isRootTrusted ? isRootTrusted(activeRoot) : true;

  const openCtx = (e: ReactMouseEvent, target: CtxPayload) => {
    setCtx({ ...target, x: e.clientX, y: e.clientY } as CtxTarget);
  };

  const newFileIn = (dirPath: string) => {
    if (onNewFileInDir) onNewFileInDir(dirPath);
    else onNewFile();
  };
  const newFolderIn = (dirPath: string) => {
    onNewFolderInDir?.(dirPath);
  };

  return (
    <>
      <div className={`side-bar-title ${embedded ? 'embedded' : ''}`}>
        {!embedded && <span>EXPLORER</span>}
        <div className="side-bar-actions">
          <button
            type="button"
            className="action"
            onClick={onNewFile}
            title="New File"
            aria-label="New File"
          >
            <span className="codicon codicon-new-file" aria-hidden />
          </button>
          {diskMode && workspaceRoots.length > 0 && (
            <>
              <button
                type="button"
                className="action"
                onClick={() =>
                  newFolderIn(encodeDiskPath(activeRootIndex, ''))
                }
                title="New Folder"
                aria-label="New Folder"
                disabled={busy || !onNewFolderInDir}
              >
                <span className="codicon codicon-new-folder" aria-hidden />
              </button>
              <button
                type="button"
                className="action"
                onClick={onRefresh}
                title="Refresh Explorer"
                aria-label="Refresh Explorer"
                disabled={busy}
              >
                <span className="codicon codicon-refresh" aria-hidden />
              </button>
              <button
                type="button"
                className="action"
                onClick={onAddFolder}
                title="Add Folder to Workspace"
                aria-label="Add Folder to Workspace"
                disabled={busy}
              >
                <span className="codicon codicon-folder-library" aria-hidden />
              </button>
              {onCloseFolder && (
                <button
                  type="button"
                  className="action"
                  onClick={() => onCloseFolder()}
                  title="Close All Folders"
                  aria-label="Close All Folders"
                  disabled={busy}
                >
                  <span className="codicon codicon-close-all" aria-hidden />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="action"
            onClick={onOpenFolder}
            title={workspaceRoots.length ? 'Open Another Folder' : 'Open Folder'}
            aria-label={workspaceRoots.length ? 'Open Another Folder' : 'Open Folder'}
            disabled={busy}
          >
            <span className="codicon codicon-folder-opened" aria-hidden />
          </button>
        </div>
      </div>

      {diskMode && workspaceRoots.length > 0 && (
        <div className="explorer-workspace-bar">
          <label className="explorer-workspace-select-wrap" title="Folders in this window">
            <span className="codicon codicon-layers" aria-hidden />
            <select
              className="explorer-workspace-select"
              value={activeRootIndex}
              onChange={(e) => onSelectRoot(Number(e.target.value))}
              aria-label="Active workspace folder"
            >
              {workspaceRoots.map((root, i) => (
                <option key={`${i}:${root}`} value={i}>
                  {workspaceFolderLabel(root)}
                </option>
              ))}
            </select>
          </label>
          <span
            className={`workspace-ability-pill ${trusted ? 'trusted' : 'restricted'}`}
            title={
              trusted
                ? 'Trusted workspace — terminal, tasks, agent'
                : 'Restricted — trust folder to enable tools'
            }
          >
            {trusted ? 'Trusted' : 'Restricted'}
          </span>
        </div>
      )}

      <div className="side-bar-scroll">
        {empty && !hideEmptyWelcome && (
          <ExplorerWelcome
            onOpenFolder={onOpenFolder}
            onCloneRepository={onCloneRepository}
            diskMode={diskMode}
          />
        )}

        {diskMode &&
          workspaceRoots.map((root, i) => (
            <WorkspaceRootSection
              key={`${i}:${root}`}
              rootIndex={i}
              rootPath={root}
              filePaths={filePaths}
              activePath={activePath}
              cutPath={cutExplorerPath}
              activeRoot={i === activeRootIndex}
              multi={workspaceRoots.length > 1}
              onOpenFile={onOpenFile}
              onSelectRoot={() => onSelectRoot(i)}
              onCloseRoot={onCloseFolder ? () => onCloseFolder(i) : undefined}
              busy={busy}
              onContextMenu={openCtx}
              selectedPaths={selectedPaths}
              dropTargetDir={dropTargetDir}
              onSelectPath={onSelectPath}
              onDragDropPaths={onDragDropPaths}
              onDropTargetChange={setDropTargetDir}
            />
          ))}

        {demoTree && (
          <div className="file-tree">
            {Object.entries(demoTree).map(([name, node]) => (
              <TreeEntry
                key={name}
                name={name}
                node={(node as Record<string, unknown>) || {}}
                level={0}
                activePath={activePath}
                selectedPaths={selectedPaths}
                dropTargetDir={dropTargetDir}
                filePaths={filePaths}
                onOpenFile={onOpenFile}
                expandSignal={filePaths.length}
                onContextMenu={openCtx}
                onSelectPath={onSelectPath}
                onDropTargetChange={setDropTargetDir}
              />
            ))}
          </div>
        )}
      </div>

      {ctx && diskMode && (
        <ExplorerContextMenu
          ctx={ctx}
          onClose={() => setCtx(null)}
          actions={{
            newFile: newFileIn,
            newFolder: newFolderIn,
            open: onOpenFile,
            openToSide: onOpenToSide,
            rename: onRenamePath,
            deletePath: onDeletePath,
            copyPath: onCopyPath,
            cutItem: onCutExplorerItem,
            copyItem: onCopyExplorerItem,
            pasteItem: onPasteExplorerItem,
            canPaste: canPasteExplorer,
            reveal: onRevealInOs,
            openInTerminal: onOpenInTerminal,
            findInFolder: onFindInFolder,
            refresh: onRefresh,
            closeRoot: onCloseFolder,
          }}
        />
      )}
    </>
  );
}
