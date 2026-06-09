import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { AppEvents } from '@/types/events';

contextBridge.exposeInMainWorld('volt', {
    platform: process.platform,
    deploy: {
        start: () => ipcRenderer.invoke('deploy:start'),
        stop: () => ipcRenderer.invoke('deploy:stop'),
        reset: () => ipcRenderer.invoke('deploy:reset')
    },
    docker: {
        preflight: () => ipcRenderer.invoke('docker:preflight')
    },
    config: {
        get: () => ipcRenderer.invoke('config:get')
    },
    shell: {
        openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
    },
    devmode: {
        apply: (payload: object) => ipcRenderer.invoke('devmode:apply', payload)
    },
    dialog: {
        pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory'),
        confirm: (options: object) => ipcRenderer.invoke('dialog:confirm', options)
    },
    app: {
        voltUrl: () => ipcRenderer.invoke('app:voltUrl'),
        openClient: () => ipcRenderer.invoke('app:openClient'),
        openShell: (intent?: string) => ipcRenderer.invoke('app:openShell', intent)
    },
    remote: {
        probe: (endpoint: string) => ipcRenderer.invoke('remote:probe', endpoint),
        connect: (endpoint: string) => ipcRenderer.invoke('remote:connect', endpoint),
        recent: () => ipcRenderer.invoke('remote:recent')
    },
    theme: {
        set: (theme: string) => ipcRenderer.invoke('theme:set', theme)
    },
    deployment: {
        get: () => ipcRenderer.invoke('deployment:get'),
        setLocal: () => ipcRenderer.invoke('deployment:setLocal'),
        reset: () => ipcRenderer.invoke('deployment:reset')
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
