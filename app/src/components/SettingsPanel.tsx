import { useEffect, useMemo, useRef, useState } from 'react';
import LlmSuiteSettingsSection from './LlmSuiteSettingsSection';
import SettingsFieldControl from './SettingsFieldControl';
import KeybindingEditor from './KeybindingEditor';
import { useObjectivSettings } from '../settingsContext';
import { isEnterpriseLicensed } from '../objectivLicense';
import {
  CATEGORY_ICONS,
  SETTINGS_CATEGORY_ORDER,
  SETTINGS_FIELDS,
  settingsSectionId,
} from '../settingsSchema';

const LLM_FIELD_KEYS_OMIT = new Set([
  'ollamaBaseUrl',
  'llmProvider',
  'llmModel',
  'llmByokBaseUrl',
  'llmByokApiKey',
  'llmByokOrg',
]);

const NAV = [
  ...SETTINGS_CATEGORY_ORDER.filter((c) => c !== 'Sync'),
  'Sync',
] as const;

type NavId = (typeof NAV)[number];

function voiceOnlyFields() {
  return SETTINGS_FIELDS.filter(
    (f) => f.category === 'LLM Suite' && f.section === 'Voice',
  );
}

export default function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const { settings, patchSettings, resetSettings, exportSettings, importSettingsFromText } =
    useObjectivSettings();
  const importRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<NavId>('Editor');

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const category = (ev as CustomEvent<{ category?: string }>).detail?.category;
      if (!category) return;
      if (NAV.includes(category as NavId)) setActiveId(category as NavId);
      setQuery('');
    };
    window.addEventListener('objectiv:open-settings', onOpen);
    return () => window.removeEventListener('objectiv:open-settings', onOpen);
  }, []);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const enterprise = isEnterpriseLicensed(settings);

  const fieldVisible = (f: (typeof SETTINGS_FIELDS)[number]) =>
  !('requiresEnterprise' in f && f.requiresEnterprise) || enterprise;

  const filteredFields = useMemo(() => {
    const base = searching
      ? SETTINGS_FIELDS.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q) ||
            f.section.toLowerCase().includes(q) ||
            String(f.key).toLowerCase().includes(q),
        )
      : SETTINGS_FIELDS;
    return base.filter(fieldVisible);
  }, [q, searching, enterprise]);

  const visibleFields = useMemo(() => {
    if (searching) return filteredFields;
    if (activeId === 'Sync' || activeId === 'LLM Suite') return [];
    return SETTINGS_FIELDS.filter((f) => f.category === activeId).filter(fieldVisible);
  }, [activeId, filteredFields, searching, enterprise]);

  const groupedSections = useMemo(() => {
    const map = new Map<string, typeof visibleFields>();
    for (const f of visibleFields) {
      const key = settingsSectionId(f.category, f.section);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return [...map.entries()].map(([id, fields]) => ({
      id,
      section: fields[0].section,
      fields,
    }));
  }, [visibleFields]);

  const searchGroups = useMemo(() => {
    if (!searching) return [];
    const byCat = new Map<string, typeof filteredFields>();
    for (const f of filteredFields) {
      if (!byCat.has(f.category)) byCat.set(f.category, []);
      byCat.get(f.category)!.push(f);
    }
    return [...byCat.entries()].map(([category, fields]) => {
      const map = new Map<string, typeof fields>();
      for (const f of fields) {
        const key = settingsSectionId(f.category, f.section);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(f);
      }
      return {
        category,
        sections: [...map.entries()].map(([id, sectionFields]) => ({
          id,
          section: sectionFields[0].section,
          fields: sectionFields,
        })),
      };
    });
  }, [filteredFields, searching]);

  return (
    <div className="settings-editor settings-editor--v2">
      <aside className="settings-nav" aria-label="Settings categories">
        <div className="settings-nav-brand">
          <span className="codicon codicon-gear" aria-hidden />
          <span>Settings</span>
        </div>
        <nav className="settings-nav-list">
          {NAV.map((id) => {
            const icon = CATEGORY_ICONS[id] ?? 'settings-gear';
            const active = !searching && activeId === id;
            return (
              <button
                key={id}
                type="button"
                className={`settings-nav-item ${active ? 'active' : ''}`}
                onClick={() => {
                  setActiveId(id);
                  setQuery('');
                }}
              >
                <span className={`codicon codicon-${icon}`} aria-hidden />
                <span className="settings-nav-label">{id}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="settings-stage">
        <header className="settings-stage-header">
          <span className="codicon codicon-search settings-stage-search-icon" aria-hidden />
          <input
            className="settings-stage-search"
            type="search"
            placeholder="Search settings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search settings"
          />
          {onClose && (
            <button type="button" className="settings-btn subtle settings-stage-close" onClick={onClose}>
              <span className="codicon codicon-close" aria-hidden />
              Close
            </button>
          )}
        </header>

        <div className="settings-stage-body">
          {searching ? (
            <>
              <h1 className="settings-headline">
                {filteredFields.length} result{filteredFields.length === 1 ? '' : 's'}
              </h1>
              {filteredFields.length === 0 ? (
                <p className="settings-empty">No settings match “{query}”.</p>
              ) : (
                searchGroups.map((group) => (
                  <div key={group.category} className="settings-group">
                    <h2 className="settings-group-title">
                      <span className={`codicon codicon-${CATEGORY_ICONS[group.category] ?? 'settings-gear'}`} />
                      {group.category}
                    </h2>
                    {group.sections.map((sec) => (
                      <section key={sec.id} className="settings-block">
                        <h3 className="settings-block-title">{sec.section}</h3>
                        <div className="settings-block-fields">
                          {sec.fields.map((field) => (
                            <SettingsFieldControl
                              key={String(field.key)}
                              field={field}
                              settings={settings}
                              patchSettings={patchSettings}
                              query={q}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ))
              )}
            </>
          ) : activeId === 'LLM Suite' ? (
            <>
              <header className="settings-headline-row">
                <h1 className="settings-headline">LLM Suite</h1>
              </header>
              <div className="settings-llm-embed">
                <LlmSuiteSettingsSection />
              </div>
              <section className="settings-block settings-block--voice">
                <h3 className="settings-block-title">Voice</h3>
                <div className="settings-block-fields">
                  {voiceOnlyFields().map((field) => (
                    <SettingsFieldControl
                      key={String(field.key)}
                      field={field}
                      settings={settings}
                      patchSettings={patchSettings}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : activeId === 'Sync' ? (
            <>
              <h1 className="settings-headline">Sync</h1>
              <section className="settings-block settings-block--sync">
                <div className="settings-sync-card">
                  <p className="settings-sync-lede">Export or import settings as JSON on this machine.</p>
                  <div className="settings-actions">
                    <button type="button" className="settings-btn primary" onClick={exportSettings}>
                      Export…
                    </button>
                    <button type="button" className="settings-btn" onClick={() => importRef.current?.click()}>
                      Import…
                    </button>
                    <input
                      ref={importRef}
                      type="file"
                      accept="application/json,.json"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void file.text().then(importSettingsFromText);
                        e.target.value = '';
                      }}
                    />
                    <button type="button" className="settings-btn subtle" onClick={resetSettings}>
                      Reset to defaults
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : activeId === 'Keybindings' ? (
            <>
              <header className="settings-headline-row">
                <h1 className="settings-headline">Keybindings</h1>
              </header>
              <section className="settings-block settings-block--keybindings">
                <div className="settings-keybindings-embed">
                  <KeybindingEditor />
                </div>
              </section>
            </>
          ) : (
            <>
              <header className="settings-headline-row">
                <h1 className="settings-headline">{activeId}</h1>
              </header>
              {groupedSections.map((group) => (
                <section key={group.id} className="settings-block">
                  <h3 className="settings-block-title">{group.section}</h3>
                  <div className="settings-block-fields">
                    {group.fields
                      .filter((f) => !LLM_FIELD_KEYS_OMIT.has(String(f.key)))
                      .map((field) => (
                        <SettingsFieldControl
                          key={String(field.key)}
                          field={field}
                          settings={settings}
                          patchSettings={patchSettings}
                        />
                      ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}