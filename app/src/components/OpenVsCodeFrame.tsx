type Props = {
  url: string;
  onBack: () => void;
};

export default function OpenVsCodeFrame({ url, onBack }: Props) {
  return (
    <div className="openvscode-shell">
      <div className="openvscode-toolbar">
        <button type="button" className="settings-btn subtle" onClick={onBack}>
          Objectiv editor
        </button>
        <span className="openvscode-toolbar-label">OpenVSCode Server</span>
      </div>
      <iframe className="openvscode-frame" src={url} title="OpenVSCode Server" />
    </div>
  );
}
