import { PRODUCT_NAME } from './branding';

export type UnsavedCloseChoice = 'save' | 'discard' | 'cancel';

const SAVE_BUTTON = 'Save';
const DISCARD_BUTTON = "Don't Save";

export async function promptUnsavedClose(fileName: string): Promise<UnsavedCloseChoice> {
  const { message } = await import('@tauri-apps/plugin-dialog');
  const result = await message(`Do you want to save the changes you made to ${fileName}?`, {
    title: PRODUCT_NAME,
    kind: 'warning',
    buttons: { yes: SAVE_BUTTON, no: DISCARD_BUTTON, cancel: 'Cancel' },
  });
  if (result === 'Yes' || result === SAVE_BUTTON) return 'save';
  if (result === 'No' || result === DISCARD_BUTTON) return 'discard';
  return 'cancel';
}
