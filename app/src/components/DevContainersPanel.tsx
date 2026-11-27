/**
 * DevContainersPanel — VS Code "Dev Containers" view.
 * Detects devcontainer.json in the workspace, shows detected containers,
 * and runs build/run/exec commands through the terminal.
 */

import { useCallback, useMemo, useState } from 'react';
import SideBarSection from './SideBarSection';
import {
  devContainerCommands,
  detectDevContainerFiles,
  parseDevContainerFile,
  type DevContainerSpec,
} from '../devContainers';

type Props = {
  workspaceFiles?: string[];
  files?: Record<string, string>;
  activeRoot?: string | null;
  onRunCommand?: (command: string, label: string) => void;
  onOpenFile?: (path: string) => void;
  className?: string;
};

export default function DevContainersPanel({
  workspaceFiles = [],
  files = {},
  activeRoot = null,
  onRunCommand,
  onOpenFile,
  className,
}: Props): JSX.Element {
  const [specOverride, setSpecOverride] = useState<DevContainerSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  const configFiles = useMemo(() => detectDevContainerFiles(workspaceFiles), [workspaceFiles]);
  const autoSpecs = useMemo(
    () =>
      configFiles
        .map((rel) => {
          const content = files[rel];
          return content ? parseDevContainerFile(rel, content) : null;
        })
        .filter((s): s is DevContainerSpec => s !== null),
    [configFiles, files],
  );
  const specs = specOverride ? [specOverride, ...autoSpecs] : autoSpecs;

  const run = useCallback(
    async (spec: DevContainerSpec, kind: 'build' | 'run' | 'exec' | 'postCreate') => {
      if (!onRunCommand || !activeRoot) return;
      setBusy(true);
      setError(null);
      const cmds = devContainerCommands(spec, activeRoot);
      try {
        if (kind === 'build') {
          if (!cmds.build) throw new Error('This container uses a prebuilt image; nothing to build.');
          setStatus((s) => ({ ...s, [spec.id]: 'building…' }));
          await onRunCommand(cmds.build, `Dev container: build ${spec.id}`);
        } else if (kind === 'run') {
          setStatus((s) => ({ ...s, [spec.id]: 'running…' }));
          await onRunCommand(cmds.run, `Dev container: run ${spec.id}`);
        } else if (kind === 'exec') {
          await onRunCommand(cmds.exec, `Dev container: exec ${spec.id}`);
        } else {
          if (!cmds.postCreate) return;
          await onRunCommand(cmds.postCreate, `Dev container: postCreate ${spec.id}`);
        }
        setStatus((s) => ({ ...s, [spec.id]: 'done' }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus((s) => ({ ...s, [spec.id]: 'error' }));
      } finally {
        setBusy(false);
      }
    },
    [activeRoot, onRunCommand],
  );

  const openSpec = useCallback(
    (spec: DevContainerSpec) => {
      onOpenFile?.(spec.path);
      setSpecOverride(spec);
    },
    [onOpenFile],
  );

  return (
    <div className={`devcontainers-panel ${className ?? ''}`}>
      <div className="side-bar-title">DEV CONTAINERS</div>

      {error && <p className="devc-error">{error}</p>}

      <SideBarSection
        title="Detected"
        count={specs.length}
        open
        onToggle={() => {}}
        className="devc-section"
      >
        {specs.length === 0 ? (
          <div className="devc-empty">
            No devcontainer.json found in this workspace.
            <p className="devc-hint">
              Create a <code>.devcontainer/devcontainer.json</code> to get started.
            </p>
          </div>
        ) : (
          specs.map((spec) => {
            const cmds = activeRoot ? devContainerCommands(spec, activeRoot) : null;
            const st = status[spec.id];
            return (
              <div key={spec.id} className="devc-item">
                <div className="devc-item-head">
                  <button
                    type="button"
                    className="devc-item-title"
                    title={spec.path}
                    onClick={() => void openSpec(spec)}
                  >
                    🐳 {spec.id}
                  </button>
                  {st ? <span className={`devc-status devc-status--${st}`}>{st}</span> : null}
                </div>
                <div className="devc-item-meta">
                  {spec.image ? `image: ${spec.image}` : null}
                  {spec.build ? `build: ${spec.build.dockerfile}` : null}
                  {spec.postCreateCommand ? '· postCreate' : null}
                </div>
                {cmds ? (
                  <div className="devc-item-actions">
                    {spec.build && (
                      <button
                        type="button"
                        className="devc-btn"
                        disabled={busy}
                        onClick={() => void run(spec, 'build')}
                      >
                        Build
                      </button>
                    )}
                    <button
                      type="button"
                      className="devc-btn primary"
                      disabled={busy}
                      onClick={() => void run(spec, 'run')}
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      className="devc-btn"
                      disabled={busy}
                      onClick={() => void run(spec, 'exec')}
                    >
                      Exec
                    </button>
                    {spec.postCreateCommand && (
                      <button
                        type="button"
                        className="devc-btn"
                        disabled={busy}
                        title={spec.postCreateCommand}
                        onClick={() => void run(spec, 'postCreate')}
                      >
                        Init
                      </button>
                    )}
                    <button
                      type="button"
                      className="devc-btn"
                      disabled={busy}
                      title="Attach terminal to running container"
                      onClick={() => {
                        const cmds = activeRoot ? devContainerCommands(spec, activeRoot) : null;
                        if (cmds?.exec) {
                          void onRunCommand?.(cmds.exec, `Dev container: attach ${spec.id}`);
                        }
                      }}
                    >
                      Attach
                    </button>
                  </div>
                ) : (
                  <p className="devc-hint">Open a workspace folder to run this container.</p>
                )}
              </div>
            );
          })
        )}
      </SideBarSection>
    </div>
  );
}
