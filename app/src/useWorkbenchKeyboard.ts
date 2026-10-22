import { useEffect } from 'react';
import type { ActivityPanel } from './activityPanels';
import type { SplitDirection } from './splitLayout';

type Handlers = {
  showPanel: (p: ActivityPanel) => void;
  openCommandPalette: () => void;
  openQuickOpen: () => void;
  openFolder: () => void;
  toggleSplit?: () => void;
  splitEditor?: (direction: SplitDirection) => void;
  toggleTerminalPanel?: () => void;
  openFile?: () => void;
  formatDocument?: () => void;
  goToSymbol?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomReset?: () => void;
  toggleSideBar?: () => void;
  togglePanel?: () => void;
  toggleFullscreen?: () => void;
  saveFile?: () => void;
  saveAllFiles?: () => void;
  /** When a browser editor tab is active. */
  toggleBrowserDevtools?: () => void;
  openBrowserSeleniumFixture?: () => void;
  openBrowserHtmlPlayground?: () => void;
  reloadBrowserTab?: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function modKey(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

export function useWorkbenchKeyboard(handlers: Handlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const mod = modKey(e);
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Window zoom works even while typing (VS Code parity).
      if (mod && !shift && !e.altKey && (key === '=' || key === '+' || e.code === 'NumpadAdd')) {
        e.preventDefault();
        handlers.zoomIn?.();
        return;
      }
      if (mod && !shift && !e.altKey && (key === '-' || key === '_' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        handlers.zoomOut?.();
        return;
      }
      if (mod && !shift && !e.altKey && (key === '0' || e.code === 'Numpad0')) {
        e.preventDefault();
        handlers.zoomReset?.();
        return;
      }

      // Save works even while typing (VS Code parity).
      if (mod && shift && !e.altKey && key === 's') {
        e.preventDefault();
        handlers.saveAllFiles?.();
        return;
      }
      if (mod && !shift && !e.altKey && key === 's') {
        e.preventDefault();
        handlers.saveFile?.();
        return;
      }

      // Layout toggles work even while typing (VS Code parity).
      if (mod && !shift && !e.altKey && key === 'b') {
        e.preventDefault();
        handlers.toggleSideBar?.();
        return;
      }
      if (mod && !shift && !e.altKey && key === 'j') {
        e.preventDefault();
        handlers.togglePanel?.();
        return;
      }
      if (e.ctrlKey && e.metaKey && !shift && key === 'f') {
        e.preventDefault();
        void handlers.toggleFullscreen?.();
        return;
      }

      if (isEditableTarget(e.target)) {
        if (!(modKey(e) && e.shiftKey && e.key.toLowerCase() === 'p')) return;
      }

      if (mod && shift && key === 'p') {
        e.preventDefault();
        handlers.openCommandPalette();
        return;
      }

      if (mod && !shift && key === 'p') {
        e.preventDefault();
        handlers.openQuickOpen();
        return;
      }

      if (mod && shift && key === 'o') {
        e.preventDefault();
        handlers.openFolder();
        return;
      }

      if (mod && !shift && key === 'o') {
        e.preventDefault();
        handlers.openFile?.();
        return;
      }

      if (mod && !shift && key === 't') {
        e.preventDefault();
        handlers.goToSymbol?.();
        return;
      }

      if (e.shiftKey && e.altKey && key === 'f') {
        e.preventDefault();
        handlers.formatDocument?.();
        return;
      }

      if (mod && key === '\\') {
        e.preventDefault();
        handlers.toggleSplit?.();
        return;
      }

      if (mod && shift && key === 'm') {
        e.preventDefault();
        handlers.showPanel('problems');
        return;
      }

      if (e.key === 'F12' && handlers.toggleBrowserDevtools) {
        e.preventDefault();
        handlers.toggleBrowserDevtools();
        return;
      }

      if (mod && e.altKey && key === 'i' && handlers.toggleBrowserDevtools) {
        e.preventDefault();
        handlers.toggleBrowserDevtools();
        return;
      }

      if (mod && shift && key === 't' && handlers.openBrowserSeleniumFixture) {
        e.preventDefault();
        handlers.openBrowserSeleniumFixture();
        return;
      }

      if (mod && shift && key === 'h' && handlers.openBrowserHtmlPlayground) {
        e.preventDefault();
        handlers.openBrowserHtmlPlayground();
        return;
      }

      if (mod && key === 'r' && handlers.reloadBrowserTab) {
        e.preventDefault();
        handlers.reloadBrowserTab();
        return;
      }

      if (mod && shift) {
        const panelMap: Record<string, ActivityPanel> = {
          e: 'explorer',
          f: 'search',
          g: 'scm',
          d: 'run',
          x: 'extensions',
          a: 'chat',
          b: 'browser',
          u: 'api',
          i: 'messages',
          l: 'llm',
        };
        const panel = panelMap[key];
        if (panel) {
          e.preventDefault();
          handlers.showPanel(panel);
          return;
        }
      }

      if (mod && !shift && key === ',') {
        e.preventDefault();
        handlers.showPanel('settings');
        return;
      }

      if (e.ctrlKey && key === '`') {
        e.preventDefault();
        handlers.toggleTerminalPanel?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}
