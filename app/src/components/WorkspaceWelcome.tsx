import { COMPANY_WORDMARK, PRODUCT_TAGLINE } from '../branding';
import { workspaceFolderLabel } from '../desktopWorkspace';

export type WelcomeShortcut = {
  label: string;
  keys: string[];
  onClick?: () => void;
};

type Props = {
  diskMode: boolean;
  recentFolders: string[];
  onOpenRecent: (path: string) => void;
  shortcuts: WelcomeShortcut[];
};

function shortPath(full: string): string {
  const parts = full.split('/').filter(Boolean);
  if (parts.length <= 4) return full;
  return `/${parts[0]}/…/${parts.slice(-2).join('/')}`;
}

function ShortcutRow({
  label,
  keys,
  meta,
  onClick,
}: WelcomeShortcut & { meta?: string }) {
  const inner = (
    <>
      <span className="workspace-welcome-shortcut-label">{label}</span>
      {keys.length > 0 ? (
        <span className="workspace-welcome-shortcut-keys">
          {keys.map((key, i) => (
            <kbd key={`${label}-${i}-${key}`}>{key}</kbd>
          ))}
        </span>
      ) : (
        meta && <span className="workspace-welcome-shortcut-meta">{meta}</span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="workspace-welcome-shortcut-row" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className="workspace-welcome-shortcut-row">{inner}</div>;
}

export default function WorkspaceWelcome({
  diskMode,
  recentFolders,
  onOpenRecent,
  shortcuts,
}: Props) {
  return (
    <div className="workspace-welcome" aria-label="Workspace">
      <div className="workspace-welcome-bg" aria-hidden />
      <img
        className="workspace-welcome-watermark"
        src="/objectiv-azo-logo.png"
        alt=""
        width={560}
        height={560}
        decoding="async"
        aria-hidden
      />

      <footer className="workspace-welcome-azing-lockup workspace-welcome-azing-lockup--transparent">
        <img
          className="workspace-welcome-azing-mark"
          src="/azing-logo.png"
          alt=""
          width={32}
          height={32}
          decoding="async"
        />
        <div className="workspace-welcome-azing-text">
          <span className="workspace-welcome-azing-name">{COMPANY_WORDMARK}</span>
          <span className="workspace-welcome-azing-product">{PRODUCT_TAGLINE}</span>
        </div>
      </footer>

      <div className="workspace-welcome-layout workspace-welcome-layout--centered">
        <nav className="workspace-welcome-shortcuts" aria-label="Shortcuts">
          {!diskMode &&
            recentFolders.map((path) => (
              <ShortcutRow
                key={path}
                label={workspaceFolderLabel(path)}
                keys={[]}
                meta={shortPath(path)}
                onClick={() => void onOpenRecent(path)}
              />
            ))}
          {shortcuts.map((s) => (
            <ShortcutRow key={s.label} {...s} />
          ))}
        </nav>
      </div>
    </div>
  );
}
