import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('volt', {
    deploy: {
        start: () => ipcRenderer.invoke('deploy:start'),
        stop:  () => ipcRenderer.invoke('deploy:stop')
    },
    config: {
        get:    () => ipcRenderer.invoke('config:get'),
        update: (payload: object) => ipcRenderer.invoke('config:update', payload)
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
        close:    () => ipcRenderer.invoke('window:close')
    },
    on: (channel: 'deploy:log' | 'deploy:state' | 'source:progress' | 'deploy:phases' | 'deploy:phase', cb: (p: any) => void) => {
        const handler = (_: IpcRendererEvent, payload: any) => cb(payload);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    }
});
