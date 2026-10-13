import { useMemo, useState } from 'react';
import SideBarSection from './SideBarSection';
import { useObjectivSettings } from '../settingsContext';

type Thread = {
  id: string;
  section: 'channels' | 'groups' | 'dms' | 'mentions' | 'unread';
  title: string;
  preview: string;
  unread: number;
};

const SEED: Thread[] = [
  { id: 'c-general', section: 'channels', title: '# general', preview: 'Standup in 10m', unread: 2 },
  { id: 'c-engineering', section: 'channels', title: '# engineering', preview: 'Objectiv sidebar PR', unread: 0 },
  { id: 'g-objectiv', section: 'groups', title: 'Objectiv team', preview: 'Release checklist', unread: 1 },
  { id: 'dm-alex', section: 'dms', title: 'Alex Kim', preview: 'Can you review the diff?', unread: 3 },
  { id: 'm-standup', section: 'mentions', title: '@you in #standup', preview: 'Need ETA on messaging panel', unread: 1 },
  { id: 'u-inbox', section: 'unread', title: 'Unread digest', preview: '4 conversations', unread: 4 },
];

const SECTIONS: { id: Thread['section']; label: string }[] = [
  { id: 'channels', label: 'Channels' },
  { id: 'groups', label: 'Groups' },
  { id: 'dms', label: 'Direct Messages' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'unread', label: 'Unread' },
];

export default function MessagingPanel() {
  const { settings } = useObjectivSettings();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, false])),
  );
  const [activeId, setActiveId] = useState<string | null>(SEED[0]?.id ?? null);

  const platform = settings.chatPlatform === 'none' ? 'Not connected' : settings.chatPlatform;

  const bySection = useMemo(() => {
    const map = new Map<Thread['section'], Thread[]>();
    for (const s of SECTIONS) map.set(s.id, []);
    for (const t of SEED) map.get(t.section)?.push(t);
    return map;
  }, []);

  return (
    <div className="messaging-panel" data-testid="messaging-panel">
      <div className="side-bar-title">
        <span>MESSAGING</span>
        <span className="messaging-platform-pill" title="Configured chat platform">
          {platform}
        </span>
      </div>
      <div className="messaging-panel-body side-bar-scroll">
        {SECTIONS.map((sec) => {
          const items = bySection.get(sec.id) ?? [];
          const unread = items.reduce((n, t) => n + t.unread, 0);
          return (
            <SideBarSection
              key={sec.id}
              title={sec.label}
              count={items.length}
              open={openSections[sec.id] ?? true}
              onToggle={() =>
                setOpenSections((prev) => ({ ...prev, [sec.id]: !prev[sec.id] }))
              }
              actions={
                unread > 0 ? (
                  <span className="messaging-unread-badge" title="Unread">
                    {unread}
                  </span>
                ) : undefined
              }
            >
              {items.length === 0 ? (
                <p className="sidebar-section-empty">None</p>
              ) : (
                <ul className="sidebar-section-list messaging-thread-list">
                  {items.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={`sidebar-section-item messaging-thread ${activeId === t.id ? 'active' : ''}`}
                        onClick={() => setActiveId(t.id)}
                      >
                        <span className="sidebar-section-item-label">{t.title}</span>
                        {t.unread > 0 && (
                          <span className="messaging-thread-unread">{t.unread}</span>
                        )}
                        <span className="messaging-thread-preview">{t.preview}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SideBarSection>
          );
        })}
      </div>
    </div>
  );
}
