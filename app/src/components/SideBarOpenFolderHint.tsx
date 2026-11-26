type Props = {
  onOpenFolder: () => void;
};

export default function SideBarOpenFolderHint({ onOpenFolder }: Props) {
  return (
    <button type="button" className="explorer-empty-btn side-bar-open-folder-btn" onClick={onOpenFolder}>
      Open Folder…
    </button>
  );
}