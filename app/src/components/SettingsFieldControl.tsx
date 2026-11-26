import type { ObjectivSettings } from '../objectivSettings';
import {
  ACCENT_PRESETS,
  normalizeAccentHex,
} from '../objectivThemes';
import type { SettingsField } from '../settingsSchema';
import { isSecretFieldKey } from '../settingsSchema';

type Props = {
  field: SettingsField;
  settings: ObjectivSettings;
  patchSettings: (patch: Partial<ObjectivSettings>) => void;
  query?: string;
};

function hintForField(field: SettingsField): string | undefined {
  return String(field.key);
}

export default function SettingsFieldControl({ field, settings, patchSettings, query }: Props) {
  const raw = settings[field.key as keyof ObjectivSettings];
  const settingId = String(field.key);
  const dimmed = query && !field.label.toLowerCase().includes(query.toLowerCase());

  if (field.kind === 'toggle') {
    const on = Boolean(raw);
    return (
      <div
        className={`settings-field settings-field--bool ${dimmed ? 'settings-field--dim' : ''}`}
        data-setting={settingId}
      >
        <div className="settings-field-copy">
          <span className="settings-field-label">{field.label}</span>
          <span className="settings-field-id">{hintForField(field)}</span>
        </div>
        <button
          type="button"
          role="switch"
          className={`settings-switch ${on ? 'on' : ''}`}
          aria-checked={on}
          aria-label={field.label}
          onClick={() => patchSettings({ [field.key]: !on } as Partial<ObjectivSettings>)}
        >
          <span className="settings-switch-thumb" aria-hidden />
        </button>
      </div>
    );
  }

  if (field.kind === 'select') {
    const value = field.toValue ? field.toValue(settings) : String(raw ?? '');
    return (
      <label
        className={`settings-field ${dimmed ? 'settings-field--dim' : ''}`}
        data-setting={settingId}
      >
        <FieldCopy field={field} />
        <select
          className="settings-control"
          value={value}
          onChange={(e) => {
            if (field.fromValue) patchSettings(field.fromValue(e.target.value));
            else patchSettings({ [field.key]: e.target.value } as Partial<ObjectivSettings>);
          }}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === 'accentColor') {
    const accent = settings.accentColor;
    const pickerValue = normalizeAccentHex(accent) ?? '#007acc';
    return (
      <div
        className={`settings-field settings-field--stack ${dimmed ? 'settings-field--dim' : ''}`}
        data-setting="accentColor"
      >
        <FieldCopy field={field} />
        <div className="settings-accent-controls">
          <input
            type="color"
            className="settings-accent-picker"
            value={pickerValue}
            aria-label="Pick accent color"
            onChange={(e) => patchSettings({ accentColor: e.target.value })}
          />
          <input
            type="text"
            className="settings-control settings-accent-hex"
            value={accent}
            placeholder="Theme default"
            spellCheck={false}
            onChange={(e) => patchSettings({ accentColor: e.target.value })}
          />
          <button
            type="button"
            className="settings-btn subtle"
            onClick={() => patchSettings({ accentColor: '' })}
          >
            Default
          </button>
        </div>
        <div className="settings-accent-swatches" role="list" aria-label="Accent presets">
          {ACCENT_PRESETS.filter((p) => p.hex).map((p) => (
            <button
              key={p.id}
              type="button"
              role="listitem"
              className={`settings-accent-swatch ${accent === p.hex ? 'active' : ''}`}
              title={p.label}
              style={{ background: p.hex }}
              onClick={() => patchSettings({ accentColor: p.hex })}
            />
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === 'number') {
    return (
      <label
        className={`settings-field ${dimmed ? 'settings-field--dim' : ''}`}
        data-setting={settingId}
      >
        <FieldCopy field={field} />
        <input
          type="number"
          className="settings-control settings-control--narrow"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={typeof raw === 'number' ? raw : 0}
          onChange={(e) =>
            patchSettings({
              [field.key]: Number(e.target.value) || 0,
            } as Partial<ObjectivSettings>)
          }
        />
      </label>
    );
  }

  const secret = isSecretFieldKey(field.key);
  const requiresEnabled = 'requiresEnabled' in field ? field.requiresEnabled : undefined;
  const gatedOff =
    requiresEnabled &&
    !Boolean(settings[requiresEnabled as keyof ObjectivSettings]);
  return (
    <label
      className={`settings-field ${dimmed ? 'settings-field--dim' : ''} ${
        gatedOff ? 'settings-field--disabled' : ''
      }`}
      data-setting={settingId}
    >
      <FieldCopy field={field} />
      <input
        type={secret ? 'password' : 'text'}
        className="settings-control"
        value={typeof raw === 'string' ? raw : ''}
        placeholder={field.placeholder}
        autoComplete={secret ? 'off' : undefined}
        disabled={Boolean(gatedOff)}
        onChange={(e) =>
          patchSettings({
            [field.key]:
              field.key === 'sidecarUrl' ||
              field.key === 'biliDaemonUrl' ||
              field.key === 'biliIngestUrl'
                ? e.target.value.replace(/\/$/, '')
                : e.target.value,
          } as Partial<ObjectivSettings>)
        }
      />
    </label>
  );
}

function FieldCopy({ field }: { field: SettingsField }) {
  return (
    <div className="settings-field-copy">
      <span className="settings-field-label">{field.label}</span>
      <span className="settings-field-id">{hintForField(field)}</span>
    </div>
  );
}