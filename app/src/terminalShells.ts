/** Built-in shell profiles for Objectiv terminal tabs. */

export type ShellProfileId = 'default' | 'bash' | 'zsh' | 'sh' | 'fish';

export type ShellProfile = {
  id: ShellProfileId;
  label: string;
  /** Empty path = use $SHELL / settings.defaultShell. */
  path: string;
};

export const SHELL_PROFILES: ShellProfile[] = [
  { id: 'default', label: 'Default ($SHELL)', path: '' },
  { id: 'zsh', label: 'zsh', path: '/bin/zsh' },
  { id: 'bash', label: 'bash', path: '/bin/bash' },
  { id: 'sh', label: 'sh', path: '/bin/sh' },
  { id: 'fish', label: 'fish', path: '/opt/homebrew/bin/fish' },
];

export function shellLabel(shellPath: string): string {
  if (!shellPath || shellPath === 'default') return 'shell';
  const base = shellPath.split('/').pop() || shellPath;
  return base;
}
