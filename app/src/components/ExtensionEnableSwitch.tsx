type Props = {
  enabled: boolean;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
  onChange: (enabled: boolean) => void;
};

export default function ExtensionEnableSwitch({
  enabled,
  disabled,
  busy,
  label = 'Extension enabled',
  onChange,
}: Props) {
  const off = disabled || busy;
  return (
    <label
      className={`extension-enable-switch${enabled ? ' is-on' : ''}${off ? ' is-disabled' : ''}`}
      title={enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
    >
      <input
        type="checkbox"
        className="extension-enable-switch-input"
        checked={enabled}
        disabled={off}
        aria-label={label}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <span className="extension-enable-switch-track" aria-hidden>
        <span className="extension-enable-switch-thumb" />
      </span>
    </label>
  );
}
