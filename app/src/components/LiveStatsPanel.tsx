import { useCallback, useEffect, useState } from 'react';
import { fetchSystemStats, type SystemStats } from '../desktopWorkspace';
import { useIsElectronDesktop } from '../useIsElectronDesktop';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function StatBar({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  return (
    <div className="live-stats-row">
      <div className="live-stats-head">
        <span>{label}</span>
        <span>{percent.toFixed(1)}%</span>
      </div>
      <div className="live-stats-bar" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="live-stats-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <div className="live-stats-detail">{detail}</div>
    </div>
  );
}

export default function LiveStatsPanel({ workspaceRoot }: { workspaceRoot?: string | null }) {
  const desktop = useIsElectronDesktop();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!desktop) return;
    try {
      const next = await fetchSystemStats(workspaceRoot ?? undefined);
      setStats(next);
      setError(null);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [desktop, workspaceRoot]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className="live-stats-panel">
      <div className="side-bar-title">LIVE STATS</div>
      {!desktop && <p className="side-bar-placeholder-hint">Live stats need the Objectiv desktop app.</p>}
      {desktop && error && <p className="live-stats-error" role="alert">{error}</p>}
      {desktop && !stats && !error && <p className="side-bar-placeholder-hint">Reading CPU, memory and disk…</p>}
      {desktop && stats && (
        <div className="live-stats-body">
          <StatBar label="CPU" percent={stats.cpu.overall} detail={`${stats.cpu.cores} cores`} />
          <StatBar label="Memory" percent={stats.memory.usedPercent} detail={`${formatBytes(stats.memory.used)} used of ${formatBytes(stats.memory.total)}`} />
          {stats.disk ? (
            <StatBar label="Disk" percent={stats.disk.usedPercent} detail={`${formatBytes(stats.disk.used)} used of ${formatBytes(stats.disk.total)}`} />
          ) : (
            <p className="side-bar-placeholder-hint">Disk usage unavailable.</p>
          )}
          <div className="live-stats-cores">
            {stats.cpu.perCore.map((pct, i) => (
              <div key={i} className="live-stats-core">
                <span>Core {i + 1}</span>
                <span>{pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className="live-stats-foot">
            <span className="live-stats-live">● Live</span>
            {updatedAt && <span>Updated {updatedAt}</span>}
            <button type="button" className="live-stats-refresh" onClick={() => void refresh()}>Refresh</button>
          </div>
        </div>
      )}
    </div>
  );
}
