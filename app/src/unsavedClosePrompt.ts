import {PRODUCT_NAME} from './branding';
import {isElectronDesktop, nativeInvoke} from './desktopBridge';

export type UnsavedCloseChoice = 'save' | 'discard' | 'cancel';

export async function promptUnsavedClose(fileName: string): Promise<UnsavedCloseChoice> {
  if (isElectronDesktop()) {
    const result = await nativeInvoke<'save' | 'discard' | 'cancel'>('dialog_message', {
      title: PRODUCT_NAME,
      message: `Do you want to save the changes you made to ${fileName}?`,
    });
    return result;
  }
  // Browser fallback (in-app confirmation).
  if (window.confirm(`Do you want to save the changes you made to ${fileName}?`)) {
    return 'save';
  }
  return 'discard';
}
