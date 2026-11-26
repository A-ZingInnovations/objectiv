import { contextBridge, ipcRenderer } from 'electron';

const listeners = new Map<string, Set<(payload: unknown) => void>>();

ipcRenderer.on('objectiv:event', (_ev, { event, payload }) => {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of set) fn(payload);
});

contextBridge.exposeInMainWorld('objectivDesktop', {
  platform: process.platform,
  invoke: <T,>(cmd: string, args: Record<string, unknown> = {}) =>
    ipcRenderer.invoke('objectiv:invoke', { cmd, args }) as Promise<T>,
  listen: <T,>(event: string, handler: (payload: T) => void) => {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    const wrap = (p: unknown) => handler(p as T);
    set.add(wrap);
    return () => set!.delete(wrap);
  },
});