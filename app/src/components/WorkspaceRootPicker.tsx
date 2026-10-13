import { workspaceFolderLabel } from '../desktopWorkspace';

type Props = {
  roots: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  isRootTrusted?: (root: string) => boolean;
};

/** Status-bar control: active folder among multi-root workspaces + trust ability. */
export default function WorkspaceRootPicker({
  roots,
  activeIndex,
  onChange,
  isRootTrusted,
}: Props) {
  if (roots.length === 0) return null;
  const active = roots[activeIndex] ?? roots[0];
  const trusted = isRootTrusted ? isRootTrusted(active) : true;

  return (
    <label
      className="segment workspace-root-picker"
      title={`Active workspace · ${active}${trusted ? '' : ' · restricted (trust folder for agent/terminal tools)'}`}
    >
      <span className="codicon codicon-root-folder" aria-hidden />
      <select
        className="workspace-root-select"
        value={activeIndex}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Active workspace folder"
      >
        {roots.map((root, i) => (
          <option key={`${i}:${root}`} value={i}>
            {workspaceFolderLabel(root)}
          </option>
        ))}
      </select>
      <span
        className={`workspace-ability-pill ${trusted ? 'trusted' : 'restricted'}`}
        title={
          trusted
            ? 'Trusted — terminal, tasks, and agent tools allowed'
            : 'Restricted — browse only until folder is trusted'
        }
      >
        {trusted ? 'Trusted' : 'Restricted'}
      </span>
    </label>
  );
}
