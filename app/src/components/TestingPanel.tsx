import {useCallback, useEffect, useMemo, useState} from 'react';
import {isElectronDesktop, readWorkspaceFile, runShellInWorkspace, scanWorkspace} from '../desktopWorkspace';
import {appendOutput, clearOutput, setOutput as setGlobalOutput} from '../outputChannel';
import {buildWorkspaceTestTree, detectPythonArtifacts, inferTestRunState, type TestRunState, type TestTreeNode, withPython} from '../testDiscovery';
import {detectWorkspaceTestArtifacts, pubspecLooksFlutter} from '../languageTests';
import {tasksFromPackageJson} from '../workspaceTasks';
import SideBarOpenFolderHint from './SideBarOpenFolderHint';

type Props = {
  workspaceRoot: string | null;
  onOpenOutput?: () => void;
  onOpenFolder?: () => void;
};

function collectCommands(nodes: TestTreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.command);
    if (n.children?.length) out.push(...collectCommands(n.children));
  }
  return [...new Set(out)];
}

function updateNodeState(
  nodes: TestTreeNode[],
  targetId: string,
  runState: TestRunState,
  inSubtree = false,
): TestTreeNode[] {
  return nodes.map((n) => {
    const hit = n.id === targetId;
    const subtree = inSubtree || hit;
    const children = n.children
      ? updateNodeState(n.children, targetId, runState, subtree)
      : undefined;
    return {
      ...n,
      runState: subtree ? runState : n.runState,
      children,
    };
  });
}

function patchAllRunState(nodes: TestTreeNode[], runState: TestRunState): TestTreeNode[] {
  return nodes.map((n) => ({
    ...n,
    runState,
    children: n.children ? patchAllRunState(n.children, runState) : undefined,
  }));
}

function nodeIcon(node: TestTreeNode, runState?: TestRunState): string {
  if (runState === 'running') return 'sync';
  if (runState === 'passed') return 'pass';
  if (runState === 'failed') return 'error';
  if (runState === 'skipped') return 'circle-slash';
  if (node.kind === 'case') return 'circle-outline';
  if (node.kind === 'file') return 'file';
  if (node.kind === 'cargo') return 'package';
  if (node.kind === 'npm') return 'json';
  if (node.kind === 'go') return 'symbol-structure';
  if (node.kind === 'dotnet') return 'file-binary';
  return 'beaker';
}

function TestTreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onRun,
  busy,
}: {
  node: TestTreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  onRun: () => void;
  busy: boolean;
}) {
  const hasChildren = Boolean(node.children?.length);
  const state = node.runState ?? 'none';
  const icon = nodeIcon(node, state === 'none' ? undefined : state);

  return (
    <>
      <div className="testing-tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            className="testing-tree-twistie"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <span className={`codicon codicon-chevron-${expanded ? 'down' : 'right'}`} aria-hidden />
          </button>
        ) : (
          <span className="testing-tree-twistie spacer" />
        )}
        <span className={`testing-tree-icon codicon codicon-${icon} state-${state}`} aria-hidden />
        <button
          type="button"
          className="testing-tree-label"
          disabled={busy}
          onClick={onRun}
          title={node.command}
        >
          {node.label}
        </button>
        <button
          type="button"
          className="testing-tree-run"
          disabled={busy}
          aria-label={`Run ${node.label}`}
          onClick={onRun}
        >
          <span className="codicon codicon-run" aria-hidden />
        </button>
      </div>
      {hasChildren &&
        expanded &&
        node.children!.map((child) => (
          <TestTreeRowContainer key={child.id} node={child} depth={depth + 1} onRun={onRun} busy={busy} />
        ))}
    </>
  );
}

function TestTreeRowContainer({
  node,
  depth,
  onRun,
  busy,
}: {
  node: TestTreeNode;
  depth: number;
  onRun: (n: TestTreeNode) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  return (
    <TestTreeRow
      node={node}
      depth={depth}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      onRun={() => onRun(node)}
      busy={busy}
    />
  );
}

export default function TestingPanel({ workspaceRoot, onOpenOutput, onOpenFolder }: Props) {
  const [tree, setTree] = useState<TestTreeNode[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastMessage, setLastMessage] = useState('');

  const discover = useCallback(async () => {
    if (!workspaceRoot || !isElectronDesktop()) {
      setTree([]);
      return;
    }
    setRefreshing(true);
    try {
      let files: string[] = [];
      try {
        files = await scanWorkspace(workspaceRoot);
      } catch {
        files = [];
      }
      const artifacts = detectPythonArtifacts(files);

      let hasCargo = false;
      try {
        await readWorkspaceFile(workspaceRoot, 'Cargo.toml');
        hasCargo = true;
      } catch {
        hasCargo = false;
      }

      let npmTestTasks: ReturnType<typeof tasksFromPackageJson> = [];
      try {
        const pkg = await readWorkspaceFile(workspaceRoot, 'package.json');
        npmTestTasks = tasksFromPackageJson(pkg).filter((t) => t.group === 'test');
      } catch {
        npmTestTasks = [];
      }

      let pubspecFlutter = false;
      try {
        const pubspec = await readWorkspaceFile(workspaceRoot, 'pubspec.yaml');
        pubspecFlutter = pubspecLooksFlutter(pubspec);
      } catch {
        pubspecFlutter = false;
      }
      const wsTestArt = detectWorkspaceTestArtifacts(files, { pubspecHasFlutter: pubspecFlutter });

      let collectOut: string | null = null;
      if (artifacts.hasPytest || artifacts.testFiles.length > 0) {
        try {
          collectOut = await runShellInWorkspace(
            workspaceRoot,
            `${withPython('-m pytest --collect-only -q')} 2>&1 || true`,
          );
        } catch {
          collectOut = null;
        }
      }

      const roots = buildWorkspaceTestTree({
        artifacts,
        pytestCollectOutput: collectOut,
        npmTestTasks,
        ws: { ...wsTestArt, hasCargo },
      });
      setTree(roots);
      setLastMessage(
        roots.length === 0
          ? 'No tests discovered — add test configs for your language (pytest, go test, cargo, npm test, …).'
          : '',
      );
    } finally {
      setRefreshing(false);
    }
  }, [workspaceRoot]);

  useEffect(() => {
    void discover();
  }, [discover]);

  const runnableCount = useMemo(() => collectCommands(tree).length, [tree]);

  async function runNode(node: TestTreeNode) {
    if (!workspaceRoot || busy) return;
    setBusy(true);
    setTree((t) => updateNodeState(t, node.id, 'running', true));
    onOpenOutput?.();
    clearOutput();
    setGlobalOutput('');
    appendOutput(`> ${node.command}`, 'Test');
    try {
      const out = await runShellInWorkspace(workspaceRoot, node.command);
      const failed =
        /(^|\n)\s*\d+ failed/.test(out) ||
        out.toLowerCase().includes('error:') ||
        out.toLowerCase().includes('command not found');
      const state = inferTestRunState(out, failed);
      setTree((t) => updateNodeState(t, node.id, state, true));
      appendOutput(out, 'Test');
      setLastMessage(state === 'passed' ? `${node.label}: passed` : `${node.label}: failed`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTree((t) => updateNodeState(t, node.id, 'failed', true));
      appendOutput(msg, 'Test');
      setLastMessage(`${node.label}: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function runAll() {
    if (!workspaceRoot || busy || tree.length === 0) return;
    setBusy(true);
    setTree((t) => patchAllRunState(t, 'running'));
    onOpenOutput?.();
    clearOutput();
    setGlobalOutput('');
    let anyFailed = false;
    for (const root of tree) {
      appendOutput(`> ${root.command}`, 'Test');
      try {
        const out = await runShellInWorkspace(workspaceRoot, root.command);
        const failed = /\d+ failed/.test(out.toLowerCase());
        anyFailed = anyFailed || failed;
        appendOutput(out, 'Test');
        const state = inferTestRunState(out, failed);
        setTree((t) => updateNodeState(t, root.id, state, true));
      } catch (e) {
        anyFailed = true;
        const msg = e instanceof Error ? e.message : String(e);
        appendOutput(msg, 'Test');
        setTree((t) => updateNodeState(t, root.id, 'failed', true));
      }
    }
    setLastMessage(anyFailed ? 'Some tests failed' : 'All discovered suites finished');
    setBusy(false);
  }

  return (
    <>
      <div className="side-bar-title">TESTING</div>
      <div className="testing-panel side-bar-placeholder">
        {!workspaceRoot &&
          (onOpenFolder ? (
            <SideBarOpenFolderHint onOpenFolder={onOpenFolder} />
          ) : (
            <p className="side-bar-placeholder-hint">Open a folder to discover tests.</p>
          ))}
        {workspaceRoot && (
          <>
            <div className="testing-toolbar" role="toolbar" aria-label="Test actions">
              <button
                type="button"
                className="testing-toolbar-btn"
                disabled={busy || tree.length === 0}
                title="Run all tests"
                onClick={() => void runAll()}
              >
                <span className="codicon codicon-run-all" aria-hidden />
              </button>
              <button
                type="button"
                className="testing-toolbar-btn"
                disabled={refreshing}
                title="Refresh tests"
                onClick={() => void discover()}
              >
                <span className={`codicon codicon-refresh ${refreshing ? 'spin' : ''}`} aria-hidden />
              </button>
              <span className="testing-toolbar-meta">
                {runnableCount > 0 ? `${runnableCount} runnable` : 'No tests'}
              </span>
            </div>
            {lastMessage && <p className="testing-status">{lastMessage}</p>}
            {tree.length === 0 && !refreshing && (
              <p className="side-bar-placeholder-hint">
                {lastMessage ||
                  'No tests found. Python, Go, Rust, npm, JVM, .NET, Ruby, PHP, Swift, Dart, Elixir, Haskell, …'}
              </p>
            )}
            <h2 className="testing-explorer-title">Test Explorer</h2>
            <div className="testing-tree" role="tree" aria-label="Tests">
              {tree.map((node) => (
                <TestTreeRowContainer
                  key={node.id}
                  node={node}
                  depth={0}
                  busy={busy}
                  onRun={(n) => void runNode(n)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}