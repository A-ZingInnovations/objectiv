/** Nested editor-group layout (VS Code–style). Each split keeps its own axis. */

export type SplitDirection = 'right' | 'left' | 'down' | 'up';

export const SPLIT_DIRECTION_LABEL: Record<SplitDirection, string> = {
  right: 'Split Right',
  left: 'Split Left',
  down: 'Split Down',
  up: 'Split Up',
};

/** Max concurrent editor leaves (tab groups). */
export const MAX_EDITOR_GROUPS = 4;

export type SplitAxis = 'horizontal' | 'vertical';

export type EditorLeaf = {
  type: 'leaf';
  id: string;
  path: string | null;
  tabs: string[];
};

export type EditorBranch = {
  type: 'branch';
  id: string;
  axis: SplitAxis;
  /** Flex weight of the first child (second is `1` for equal, or paired). */
  firstSize: number;
  secondSize: number;
  first: EditorNode;
  second: EditorNode;
};

export type EditorNode = EditorLeaf | EditorBranch;

/** @deprecated flat group — prefer EditorLeaf via layout tree */
export type EditorGroupState = {
  id: string;
  path: string | null;
  tabs: string[];
  size: number;
};

export function isVerticalSplit(direction: SplitDirection): boolean {
  return direction === 'up' || direction === 'down';
}

export function splitAxis(direction: SplitDirection): SplitAxis {
  return isVerticalSplit(direction) ? 'vertical' : 'horizontal';
}

export function newEditorGroupId(prefix = 'g'): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createRootLeaf(path: string | null = null, tabs: string[] = []): EditorLeaf {
  return {
    type: 'leaf',
    id: 'primary',
    path,
    tabs: path && !tabs.includes(path) ? [...tabs, path] : [...tabs],
  };
}

function uniqueTabs(tabs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tabs) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function withPaneTab(leaf: EditorLeaf, path: string, activate = true): EditorLeaf {
  const tabs = leaf.tabs.includes(path) ? leaf.tabs : [...leaf.tabs, path];
  return { ...leaf, tabs, path: activate ? path : leaf.path };
}

export function collectLeaves(node: EditorNode): EditorLeaf[] {
  if (node.type === 'leaf') return [node];
  return [...collectLeaves(node.first), ...collectLeaves(node.second)];
}

export function countLeaves(node: EditorNode): number {
  if (node.type === 'leaf') return 1;
  return countLeaves(node.first) + countLeaves(node.second);
}

export function findLeaf(node: EditorNode, id: string): EditorLeaf | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findLeaf(node.first, id) ?? findLeaf(node.second, id);
}

export function mapLeaf(
  node: EditorNode,
  id: string,
  fn: (leaf: EditorLeaf) => EditorLeaf,
): EditorNode {
  if (node.type === 'leaf') {
    return node.id === id ? fn(node) : node;
  }
  return {
    ...node,
    first: mapLeaf(node.first, id, fn),
    second: mapLeaf(node.second, id, fn),
  };
}

function removePathFromLeaf(leaf: EditorLeaf, path: string): EditorLeaf {
  const tabs = leaf.tabs.filter((t) => t !== path);
  const nextPath =
    leaf.path === path ? (tabs.length ? tabs[tabs.length - 1]! : null) : leaf.path;
  return { ...leaf, tabs, path: nextPath };
}

/**
 * Split the focused leaf in `direction`.
 * `move: true` — file leaves the source leaf and only lives in the new pane.
 */
export function splitLeafInLayout(
  root: EditorNode,
  focusId: string,
  direction: SplitDirection,
  path: string | null,
  opts?: { move?: boolean },
): { root: EditorNode; focusId: string } | null {
  if (countLeaves(root) >= MAX_EDITOR_GROUPS) return null;
  const move = opts?.move !== false;
  const newId = newEditorGroupId();
  const axis = splitAxis(direction);
  const newFirst = direction === 'left' || direction === 'up';

  const newLeaf: EditorLeaf = {
    type: 'leaf',
    id: newId,
    path,
    tabs: path ? [path] : [],
  };

  const replace = (node: EditorNode): EditorNode | null => {
    if (node.type === 'leaf') {
      if (node.id !== focusId) return null;
      let source = { ...node, tabs: [...node.tabs] };
      if (path && move) source = removePathFromLeaf(source, path);
      const branch: EditorBranch = {
        type: 'branch',
        id: newEditorGroupId('b'),
        axis,
        firstSize: 1,
        secondSize: 1,
        first: newFirst ? newLeaf : source,
        second: newFirst ? source : newLeaf,
      };
      return branch;
    }
    const first = replace(node.first);
    if (first) return { ...node, first };
    const second = replace(node.second);
    if (second) return { ...node, second };
    return null;
  };

  const next = replace(root);
  if (!next) return null;
  return { root: next, focusId: newId };
}

/** Update flex sizes on the branch that directly contains the sash between two sibling leaves/branches. */
export function setBranchSizes(
  root: EditorNode,
  branchId: string,
  firstSize: number,
  secondSize: number,
): EditorNode {
  if (root.type === 'leaf') return root;
  if (root.id === branchId) {
    return { ...root, firstSize, secondSize };
  }
  return {
    ...root,
    first: setBranchSizes(root.first, branchId, firstSize, secondSize),
    second: setBranchSizes(root.second, branchId, firstSize, secondSize),
  };
}

/** Collapse layout to a single leaf, merging all tabs. */
export function flattenLayout(root: EditorNode, keepPath: string | null): EditorLeaf {
  const leaves = collectLeaves(root);
  const tabs = uniqueTabs(leaves.flatMap((l) => l.tabs));
  const path =
    keepPath && tabs.includes(keepPath)
      ? keepPath
      : tabs.length
        ? tabs[tabs.length - 1]!
        : null;
  return { type: 'leaf', id: 'primary', path, tabs };
}

/** Remove a leaf; promote sibling. Returns null if last leaf would be removed. */
export function removeLeaf(root: EditorNode, leafId: string): EditorNode | null {
  if (root.type === 'leaf') {
    return root.id === leafId ? null : root;
  }
  if (root.first.type === 'leaf' && root.first.id === leafId) return root.second;
  if (root.second.type === 'leaf' && root.second.id === leafId) return root.first;
  const first = removeLeaf(root.first, leafId);
  if (first && first !== root.first) return { ...root, first };
  const second = removeLeaf(root.second, leafId);
  if (second && second !== root.second) return { ...root, second };
  return root;
}

/** Flat helpers kept for callers still using group lists. */
export function addEditorGroup(
  groups: EditorGroupState[],
  focusId: string,
  direction: SplitDirection,
  path: string | null,
  opts?: { move?: boolean },
): { groups: EditorGroupState[]; focusId: string } | null {
  // Bridge: treat flat list as horizontal/vertical strip (legacy). Prefer splitLeafInLayout.
  if (groups.length >= MAX_EDITOR_GROUPS) return null;
  const idx = Math.max(0, groups.findIndex((g) => g.id === focusId));
  const insertAt = direction === 'left' || direction === 'up' ? idx : idx + 1;
  const id = newEditorGroupId();
  const move = opts?.move !== false;
  const next = groups.map((g) => ({ ...g, tabs: [...g.tabs] }));
  const src = next[idx];
  if (src && path && move) {
    src.tabs = src.tabs.filter((t) => t !== path);
    if (src.path === path) src.path = src.tabs.length ? src.tabs[src.tabs.length - 1]! : null;
  }
  next.splice(insertAt, 0, { id, path, tabs: path ? [path] : [], size: 1 });
  return { groups: next.map((g) => ({ ...g, size: 1 })), focusId: id };
}

export function mergeEditorGroups(
  groups: EditorGroupState[],
  keepPath: string | null,
): EditorGroupState {
  const tabs = uniqueTabs(groups.flatMap((g) => g.tabs));
  const path =
    keepPath && tabs.includes(keepPath)
      ? keepPath
      : tabs.length
        ? tabs[tabs.length - 1]!
        : null;
  return { id: 'primary', path, tabs, size: 1 };
}
