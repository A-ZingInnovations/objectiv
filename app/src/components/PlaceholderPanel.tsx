import type { ActivityPanel } from '../activityPanels';
import { panelTitle } from '../activityPanels';

type Props = {
  panel: ActivityPanel;
  gitLines?: string[];
};

const COPY: Partial<Record<ActivityPanel, string>> = {
  search: 'Workspace search (ripgrep) — Phase C.',
  run: 'Run and debug — Phase C.',
  extensions: 'Extension marketplace is VS Code / Cursor + Objective extension.',
  settings: 'Settings — Phase C.',
};

export default function PlaceholderPanel({ panel, gitLines }: Props) {
  const title = panelTitle(panel);
  const hint = COPY[panel] ?? 'Coming in a later Objectiv release.';

  return (
    <>
      <div className="side-bar-title">{title}</div>
      <div className="side-bar-placeholder">
        {panel === 'scm' && gitLines && gitLines.length > 0 ? (
          <>
            <p className="side-bar-placeholder-hint">Git status (read-only)</p>
            <pre className="git-strip open">{gitLines.join('\n')}</pre>
            <p className="side-bar-placeholder-hint">Stage / commit UI — Phase B.</p>
          </>
        ) : (
          <p className="side-bar-placeholder-hint">{hint}</p>
        )}
      </div>
    </>
  );
}
