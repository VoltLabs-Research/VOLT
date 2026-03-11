import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createDefaultDesktopWindowState,
    DesktopIpcChannel,
    DesktopPlatform,
    DesktopWindowAction,
    type DesktopWindowState
} from '../src/shared/utils/electron-contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDevelopment = !app.isPackaged;
const rendererDistPath = path.join(__dirname, '../../dist');
const preloadPath = path.join(__dirname, 'preload.js');
const developmentServerUrl = process.env.VITE_DEV_SERVER_URL;
const defaultWindowWidth = 1800;
const defaultWindowHeight = 960;
const defaultMinWindowWidth = 1180;
const defaultMinWindowHeight = 720;

const createDesktopWindowState = (window: BrowserWindow): DesktopWindowState => {
    return {
        isFullScreen: window.isFullScreen(),
        isMaximized: window.isMaximized()
    };
};

const isDevToolsShortcut = (input: Electron.Input): boolean => {
    const key = input.key.toLowerCase();
    const isFunctionShortcut = key === 'f12';
    const isWindowsShortcut = input.control && input.shift && ['c', 'i', 'j'].includes(key);
    const isMacShortcut = input.meta && input.alt && ['c', 'i', 'j'].includes(key);

    return isFunctionShortcut || isWindowsShortcut || isMacShortcut;
};

const broadcastWindowState = (window: BrowserWindow) => {
    window.webContents.send(DesktopIpcChannel.WindowStateChanged, createDesktopWindowState(window));
};

const registerWindowSecurity = (window: BrowserWindow) => {
    if (isDevelopment) {
        return;
    }

    window.webContents.on('before-input-event', (event, input) => {
        if (isDevToolsShortcut(input)) {
            event.preventDefault();
        }
    });

    window.webContents.on('devtools-opened', () => {
        window.webContents.closeDevTools();
    });
};

const registerWindowStateObservers = (window: BrowserWindow) => {
    const emitWindowState = () => {
        broadcastWindowState(window);
    };

    window.on('maximize', emitWindowState);
    window.on('unmaximize', emitWindowState);
    window.on('enter-full-screen', emitWindowState);
    window.on('leave-full-screen', emitWindowState);
};

const createMainWindow = () => {
    const { width: availableWidth, height: availableHeight } = screen.getPrimaryDisplay().workAreaSize;
    const mainWindow = new BrowserWindow({
        width: Math.min(defaultWindowWidth, availableWidth),
        height: Math.min(defaultWindowHeight, availableHeight),
        minWidth: Math.min(defaultMinWindowWidth, availableWidth),
        minHeight: Math.min(defaultMinWindowHeight, availableHeight),
        frame: false,
        transparent: true,
        titleBarStyle: process.platform === DesktopPlatform.MacOS ? 'hidden' : 'default',
        autoHideMenuBar: true,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            devTools: isDevelopment,
            spellcheck: false
        }
    });

    if (!isDevelopment) {
        mainWindow.removeMenu();
    }

    registerWindowSecurity(mainWindow);
    registerWindowStateObservers(mainWindow);

    if (developmentServerUrl) {
        mainWindow.loadURL(developmentServerUrl);
    } else {
        mainWindow.loadFile(path.join(rendererDistPath, 'index.html'));
    }

    mainWindow.webContents.once('did-finish-load', () => {
        broadcastWindowState(mainWindow);
    });

    return mainWindow;
};

app.whenReady().then(() => {
    if (!isDevelopment) {
        Menu.setApplicationMenu(null);
    }

    ipcMain.handle(DesktopIpcChannel.GetWindowState, (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (!window) {
            return createDefaultDesktopWindowState();
        }

        return createDesktopWindowState(window);
    });

    ipcMain.handle(DesktopIpcChannel.PerformWindowAction, (event, action: DesktopWindowAction) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (!window) {
            return;
        }

        if (action === DesktopWindowAction.Minimize) {
            window.minimize();
            return;
        }

        if (action === DesktopWindowAction.ToggleMaximize) {
            if (window.isMaximized()) {
                window.unmaximize();
                return;
            }

            window.maximize();
            return;
        }

        if (action === DesktopWindowAction.Close) {
            window.close();
        }
    });

    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== DesktopPlatform.MacOS) {
        app.quit();
    }
});
