import type { ExtensionSelection } from './components/ExtensionDetail';

const PREFIX = 'extension:';

export function extensionTabId(extensionId: string): string {
  return `${PREFIX}${extensionId}`;
}

export function isExtensionTab(tabId: string | null | undefined): boolean {
  return Boolean(tabId?.startsWith(PREFIX));
}

export function extensionIdFromTab(tabId: string): string {
  return tabId.slice(PREFIX.length);
}

export function extensionIdFromSelection(selection: ExtensionSelection): string {
  return selection.source === 'installed' ? selection.ext.id : selection.entry.id;
}

export function extensionLabelFromSelection(selection: ExtensionSelection): string {
  return selection.source === 'installed' ? selection.ext.name : selection.entry.name;
}
