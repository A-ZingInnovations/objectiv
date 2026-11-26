import { BrowserWindow } from 'electron';

export function broadcastEvent(event: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('objectiv:event', { event, payload });
  }
}