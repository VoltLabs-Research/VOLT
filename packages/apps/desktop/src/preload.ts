import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { DesktopUpdateState } from '@volt/contracts/modules/system/domain';

interface WindowState{
    maximized: boolean;
}

interface ChannelPayloads{
    'window:state': WindowState;
    'app:update:state': DesktopUpdateState;
}

// The client's bridge to the window: its controls, its state and the app's own update. Its presence
// is also how the client knows it runs in the desktop app, where it always runs its own stack.
contextBridge.exposeInMainWorld('volt', {
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close')
    },

    update: {
        get: (): Promise<DesktopUpdateState> => ipcRenderer.invoke('app:update:get'),
        // Restarts into the downloaded version, or opens the release to download by hand.
        apply: (): Promise<void> => ipcRenderer.invoke('app:update:apply')
    },

    on: <TChannel extends keyof ChannelPayloads>(channel: TChannel, cb: (payload: ChannelPayloads[TChannel]) => void) => {
        const handler = (_: IpcRendererEvent, payload: ChannelPayloads[TChannel]): void => cb(payload);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    }
});
