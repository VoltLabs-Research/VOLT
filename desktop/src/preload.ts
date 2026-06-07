import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { AppEvents } from '@/types/events';

contextBridge.exposeInMainWorld('volt', {
    platform: process.platform,
    deploy: {
        start: () => ipcRenderer.invoke('deploy:start'),
        stop: () => ipcRenderer.invoke('deploy:stop'),
        reset: () => ipcRenderer.invoke('deploy:reset')
    },
    config: {
        get: () => ipcRenderer.invoke('config:get')
    },
    devmode: {
        apply: (payload: object) => ipcRenderer.invoke('devmode:apply', payload)
    },
    dialog: {
        pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory')
    },
    app: {
        voltUrl: () => ipcRenderer.invoke('app:voltUrl')
    },
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close')
    },
    on: (channel: keyof AppEvents, cb: (p: any) => void) => {
        const handler = (_: IpcRendererEvent, payload: any) => cb(payload);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    }
});
