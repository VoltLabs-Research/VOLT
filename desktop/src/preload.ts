import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('volt', {
    deploy: {
        start: () => ipcRenderer.invoke('deploy:start'),
        stop: () => ipcRenderer.invoke('deploy:stop'),
        status: () => ipcRenderer.invoke('deploy:status')
    },
    config: {
        get: () => ipcRenderer.invoke('config:get'),
        update: (payload: object) => ipcRenderer.invoke('config:update', payload)
    },
    on: (channel: 'deploy:log' | 'deploy:state' | 'source:progress', cb: (p: any) => void) => {
        const handler = (_: IpcRendererEvent, payload: any) => cb(payload);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    }
});