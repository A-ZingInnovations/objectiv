import { displayPath } from '../workspaceDisk';
import { resolveSetiFileIcon } from '../seti/setiFileIconTheme';
import { useObjectivSettings } from '../settingsContext';
import { themeBaseKind } from '../objectivThemes';

type Props = {
  path: string;
  /** Extra classes (e.g. tab-icon, icon, search-file-icon). */
  className?: string;
  size?: 'sm' | 'md';
};

/** VS Code Seti file icon (same font + theme JSON as `theme-seti`). */
export default function FileTypeIcon({ path, className = '', size = 'md' }: Props) {
  const { settings } = useObjectivSettings();
  const light = themeBaseKind(settings.workbenchColorTheme) === 'light';
  const rel = displayPath(path);
  const { glyph, color, fontSize } = resolveSetiFileIcon(rel, light);
  const sizeClass = size === 'sm' ? 'seti-file-icon--sm' : 'seti-file-icon--md';

  return (
    <span
      className={`seti-file-icon ${sizeClass} ${className}`.trim()}
      style={{
        color: color ?? undefined,
        fontSize: fontSize ?? undefined,
      }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}
