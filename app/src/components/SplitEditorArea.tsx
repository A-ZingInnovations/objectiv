import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DocumentPaneProps } from './DocumentPane';
import type { EditorBranch, EditorLeaf, EditorNode, SplitAxis } from '../splitLayout';

export type EditorPaneId = string;
export type EditorPaneProps = DocumentPaneProps;

type Props = {
  layout: EditorNode;
  focus: EditorPaneId;
  renderLeaf: (leaf: EditorLeaf) => ReactNode;
  onFocusPane: (pane: EditorPaneId) => void;
  onBranchSizes: (branchId: string, firstSize: number, secondSize: number) => void;
};

const MIN_FRAC = 0.1;

function clampPair(left: number, right: number, sum: number): [number, number] {
  const min = sum * MIN_FRAC;
  let l = left;
  let r = right;
  if (l < min) {
    r -= min - l;
    l = min;
  }
  if (r < min) {
    l -= min - r;
    r = min;
  }
  return [Math.max(min, l), Math.max(min, r)];
}

function BranchSplit({
  branch,
  focus,
  renderLeaf,
  onFocusPane,
  onBranchSizes,
}: {
  branch: EditorBranch;
  focus: EditorPaneId;
  renderLeaf: (leaf: EditorLeaf) => ReactNode;
  onFocusPane: (pane: EditorPaneId) => void;
  onBranchSizes: (branchId: string, firstSize: number, secondSize: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const axis: SplitAxis = branch.axis;
  const [live, setLive] = useState<[number, number] | null>(null);
  const dragRef = useRef<{ startPos: number; start: [number, number] } | null>(null);
  const onSizesRef = useRef(onBranchSizes);
  onSizesRef.current = onBranchSizes;

  const sizes: [number, number] = live ?? [
    Math.max(0.01, branch.firstSize),
    Math.max(0.01, branch.secondSize),
  ];

  useEffect(() => {
    if (!live) return;
    if (
      Math.abs(live[0] - branch.firstSize) < 0.001 &&
      Math.abs(live[1] - branch.secondSize) < 0.001
    ) {
      setLive(null);
    }
  }, [branch.firstSize, branch.secondSize, live]);

  const onMove = useCallback(
    (e: MouseEvent) => {
      const drag = dragRef.current;
      const root = rootRef.current;
      if (!drag || !root) return;
      const rect = root.getBoundingClientRect();
      const span = axis === 'vertical' ? rect.height : rect.width;
      if (span <= 0) return;
      const pos = axis === 'vertical' ? e.clientY : e.clientX;
      const total = drag.start[0] + drag.start[1];
      const delta = ((pos - drag.startPos) / span) * total;
      const [l, r] = clampPair(drag.start[0] + delta, drag.start[1] - delta, total);
      setLive([l, r]);
    },
    [axis],
  );

  const onUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    document.body.classList.remove('objectiv-resizing-x', 'objectiv-resizing-y');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    setLive((cur) => {
      if (cur) onSizesRef.current(branch.id, cur[0], cur[1]);
      return cur;
    });
  }, [onMove, branch.id]);

  const startResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        startPos: axis === 'vertical' ? e.clientY : e.clientX,
        start: [...sizes] as [number, number],
      };
      setLive([...sizes] as [number, number]);
      document.body.classList.add(axis === 'vertical' ? 'objectiv-resizing-y' : 'objectiv-resizing-x');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [axis, sizes, onMove, onUp],
  );

  useEffect(
    () => () => {
      document.body.classList.remove('objectiv-resizing-x', 'objectiv-resizing-y');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    },
    [onMove, onUp],
  );

  const vertical = axis === 'vertical';
  const sum = sizes[0] + sizes[1] || 1;

  return (
    <div
      ref={rootRef}
      className={[
        'editor-split',
        vertical ? 'editor-split-vertical' : 'editor-split-horizontal',
        live ? 'editor-split-resizing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-resizing={live ? 'true' : undefined}
    >
      <div className="editor-split-child" style={{ flex: `${sizes[0] / sum} 1 0` }}>
        <SplitNode
          node={branch.first}
          focus={focus}
          renderLeaf={renderLeaf}
          onFocusPane={onFocusPane}
          onBranchSizes={onBranchSizes}
        />
      </div>
      <div
        className="editor-split-divider"
        role="separator"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        title="Drag to resize"
        onMouseDown={startResize}
        onDoubleClick={() => {
          setLive([1, 1]);
          onBranchSizes(branch.id, 1, 1);
        }}
      />
      <div className="editor-split-child" style={{ flex: `${sizes[1] / sum} 1 0` }}>
        <SplitNode
          node={branch.second}
          focus={focus}
          renderLeaf={renderLeaf}
          onFocusPane={onFocusPane}
          onBranchSizes={onBranchSizes}
        />
      </div>
    </div>
  );
}

function SplitNode({
  node,
  focus,
  renderLeaf,
  onFocusPane,
  onBranchSizes,
}: {
  node: EditorNode;
  focus: EditorPaneId;
  renderLeaf: (leaf: EditorLeaf) => ReactNode;
  onFocusPane: (pane: EditorPaneId) => void;
  onBranchSizes: (branchId: string, firstSize: number, secondSize: number) => void;
}) {
  if (node.type === 'leaf') {
    return (
      <div
        className={`editor-pane ${focus === node.id ? 'focused' : ''} ${focus === node.id ? '' : ''}`.trim()}
        onMouseDown={() => onFocusPane(node.id)}
      >
        {renderLeaf(node)}
      </div>
    );
  }
  return (
    <BranchSplit
      branch={node}
      focus={focus}
      renderLeaf={renderLeaf}
      onFocusPane={onFocusPane}
      onBranchSizes={onBranchSizes}
    />
  );
}

export default function SplitEditorArea({
  layout,
  focus,
  renderLeaf,
  onFocusPane,
  onBranchSizes,
}: Props) {
  if (layout.type === 'leaf') {
    return (
      <div className="editor-pane single" onMouseDown={() => onFocusPane(layout.id)}>
        {renderLeaf(layout)}
      </div>
    );
  }

  return (
    <div className="editor-wrap-split-tree">
      <SplitNode
        node={layout}
        focus={focus}
        renderLeaf={renderLeaf}
        onFocusPane={onFocusPane}
        onBranchSizes={onBranchSizes}
      />
    </div>
  );
}
