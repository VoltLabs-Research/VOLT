import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { isClientUrl } from '@/services/WindowSecurity';
import { applyDesktopUpdate, desktopUpdates } from '@/services/AppUpdater';

// The window is frameless: the client draws its controls and asks for them here, along with the
// app's own update. Only the client's own pages are answered.
const handleFromClient = (channel: string, handler: (event: IpcMainInvokeEvent) => unknown): void => {
    ipcMain.handle(channel, (event) => {
        if(!isClientUrl(event.senderFrame?.url ?? '')){
            throw new Error(`Channel ${channel} is only available to the Volt client`);
        }

        return handler(event);
    });
};

export const registerIpc = (win: BrowserWindow) => {
    handleFromClient('window:minimize', () => win.minimize());
    handleFromClient('window:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
    handleFromClient('window:close', () => win.close());
    handleFromClient('app:update:get', () => desktopUpdates.state);
    handleFromClient('app:update:apply', () => applyDesktopUpdate());
};
