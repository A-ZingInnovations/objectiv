import type { ITheme } from '@xterm/xterm';
import type { WorkbenchColorThemeId } from './objectivThemes';
import { themeBaseKind } from './objectivThemes';

export function xtermThemeForWorkbench(themeId: WorkbenchColorThemeId): ITheme {
  const light = themeBaseKind(themeId) === 'light';
  if (light) {
    return {
      background: '#fafafa',
      foreground: '#383838',
      cursor: '#0078d4',
      cursorAccent: '#fafafa',
      selectionBackground: 'rgba(0, 120, 212, 0.28)',
      black: '#000000',
      red: '#cd3131',
      green: '#00bc00',
      yellow: '#949800',
      blue: '#0451a5',
      magenta: '#bc05bc',
      cyan: '#0598bc',
      white: '#666666',
      brightBlack: '#666666',
      brightRed: '#cd3131',
      brightGreen: '#14ce14',
      brightYellow: '#b5ba00',
      brightBlue: '#0451a5',
      brightMagenta: '#bc05bc',
      brightCyan: '#0598bc',
      brightWhite: '#1f1f1f',
    };
  }
  return {
    background: '#0c0c0c',
    foreground: '#d4d4d4',
    cursor: '#4ade80',
    cursorAccent: '#0c0c0c',
    selectionBackground: 'rgba(74, 222, 128, 0.22)',
  };
}
