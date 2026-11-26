import React from 'react';
import ReactDOM from 'react-dom/client';
import './monacoSetup';
import App from './App';
import ExplorerHarness from './e2e/ExplorerHarness';
import RunPanelHarness from './e2e/RunPanelHarness';
import MessagingPanel from './components/MessagingPanel';
import TerminalPopoutApp from './components/TerminalPopoutApp';
import { loadSettings } from './objectivSettings';
import { applyWorkbenchAppearance } from './objectivThemes';
import { SettingsProvider } from './settingsContext';
import { isTerminalSurface } from './terminalPopout';
import '@vscode/codicons/dist/codicon.css';
import './index.css';

const boot = loadSettings();
applyWorkbenchAppearance({
  workbenchColorTheme: boot.workbenchColorTheme,
  accentColor: boot.accentColor,
});

const e2eMode =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('e2e')
    : null;

const surface = isTerminalSurface() ? (
  <TerminalPopoutApp />
) : e2eMode === 'explorer' ? (
  <ExplorerHarness />
) : e2eMode === 'run' ? (
  <RunPanelHarness />
) : e2eMode === 'messages' ? (
  <MessagingPanel />
) : (
  <App />
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>{surface}</SettingsProvider>
  </React.StrictMode>,
);
