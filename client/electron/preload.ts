import { contextBridge, ipcRenderer } from 'electron';
import {
    createDefaultDesktopWindowState,
    DesktopIpcChannel,
    DesktopWindowAction,
    isDesktopWindowState,
    resolveDesktopPlatform,
    type DesktopWindowState,
    type VoltDesktopApi
} from '../src/shared/utils/electron-contract.js';

const desktopApi: VoltDesktopApi = {
    isElectron: true,
    platform: resolveDesktopPlatform(process.platform),
    windowControls: {
        minimize: async () => {
            await ipcRenderer.invoke(DesktopIpcChannel.PerformWindowAction, DesktopWindowAction.Minimize);
        },
        toggleMaximize: async () => {
            await ipcRenderer.invoke(DesktopIpcChannel.PerformWindowAction, DesktopWindowAction.ToggleMaximize);
        },
        close: async () => {
            await ipcRenderer.invoke(DesktopIpcChannel.PerformWindowAction, DesktopWindowAction.Close);
        },
        getState: async () => {
            const windowState = await ipcRenderer.invoke(DesktopIpcChannel.GetWindowState);

            if (isDesktopWindowState(windowState)) {
                return windowState;
            }

            return createDefaultDesktopWindowState();
        },
        onStateChange: (callback) => {
            const listener = (_event: Electron.IpcRendererEvent, state: DesktopWindowState) => {
                callback(state);
            };

            ipcRenderer.on(DesktopIpcChannel.WindowStateChanged, listener);

            return () => {
                ipcRenderer.removeListener(DesktopIpcChannel.WindowStateChanged, listener);
            };
        }
    }
};

contextBridge.exposeInMainWorld('voltDesktop', desktopApi);
