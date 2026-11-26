import {isElectronDesktop} from '../desktopWorkspace';
import {useObjectivOpenVsCodeWebview} from '../useObjectivOpenVsCodeWebview';

type Props = {
  url: string;
  active?: boolean;
  onBack: () => void;
};

export default function OpenVsCodeFrame({ url, active = true, onBack }: Props) {
  const useNative = isElectronDesktop();
  const hostRef = useObjectivOpenVsCodeWebview(url, useNative && active);

  return (
    <div className="openvscode-shell">
      <div className="openvscode-toolbar">
        <button type="button" className="settings-btn subtle" onClick={onBack}>
          Objectiv editor
        </button>
        <span className="openvscode-toolbar-label">OpenVSCode Server</span>
      </div>
      {useNative ? (
        <div ref={hostRef} className="openvscode-frame-host" aria-label="OpenVSCode Server" />
      ) : (
        <iframe
          className="openvscode-frame"
          src={url}
          title="OpenVSCode Server"
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
}
