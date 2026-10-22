import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

interface WindowState{
    maximized: boolean;
}

// The client's bridge to the window: its controls and its state. Its presence is also how the client
// knows it runs in the desktop app, where it always runs its own stack.
contextBridge.exposeInMainWorld('volt', {
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close')
    },

    on: (channel: 'window:state', cb: (payload: WindowState) => void) => {
        const handler = (_: IpcRendererEvent, payload: WindowState): void => cb(payload);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    }
});
