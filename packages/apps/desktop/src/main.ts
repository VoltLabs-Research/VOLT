import { app, BrowserWindow, dialog, screen } from 'electron';
import { existsSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import AppConfig, { WindowBounds } from '@/services/AppConfig';
import { resolveAppPaths } from '@/services/AppPaths';
import { CLIENT_ORIGIN, clientSession } from '@/services/ClientProtocol';
import { applyWindowSecurity, sendToClient } from '@/services/WindowSecurity';
import { startAppUpdater } from '@/services/AppUpdater';
import { registerIpc } from '@/ipc';

// The window's page hosts the whole stack in its workers: it keeps running when the window is hidden.
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
if(process.platform === 'win32') app.setAppUserModelId('com.voltlabs.volt');

process.on('unhandledRejection', (reason: unknown) => {
    console.error('[main] unhandled rejection:', reason instanceof Error ? reason.stack ?? reason.message : reason);
});

process.on('uncaughtException', (error: Error) => {
    console.error('[main] uncaught exception:', error.stack ?? error.message);
});

const MIN_WIDTH = 940;
const MIN_HEIGHT = 640;

if(!app.requestSingleInstanceLock()){
    app.quit();
    process.exit(0);
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const visualChrome = (): Electron.BrowserWindowConstructorOptions => {
    if(process.platform === 'darwin'){
        return {
            vibrancy: 'under-window',
            visualEffectState: 'active',
            roundedCorners: true,
            backgroundColor: '#00000000'
        };
    }
    if(process.platform === 'win32'){
        return {
            backgroundColor: '#0c0c0c'
        };
    }
    return {
        transparent: true,
        backgroundColor: '#00000000'
    };
};

const visibleBounds = (bounds: WindowBounds | null): WindowBounds | null => {
    if(!bounds || bounds.x === undefined || bounds.y === undefined) return bounds;
    const { x, y, width, height } = bounds;
    const onScreen = screen.getAllDisplays().some((display) => {
        const area = display.workArea;
        return x < area.x + area.width
            && x + width > area.x
            && y < area.y + area.height
            && y + height > area.y;
    });
    return onScreen ? bounds : {
        width,
        height,
        maximized: bounds.maximized
    };
};

const createWindow = (initialBounds: WindowBounds | null, clientDir: string): BrowserWindow => {
    const win = new BrowserWindow({
        width: Math.max(initialBounds?.width ?? 1600, MIN_WIDTH),
        height: Math.max(initialBounds?.height ?? 1000, MIN_HEIGHT),
        ...(initialBounds?.x !== undefined ? { x: initialBounds.x } : {}),
        ...(initialBounds?.y !== undefined ? { y: initialBounds.y } : {}),
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
        show: false,
        frame: false,
        ...visualChrome(),
        webPreferences: {
            session: clientSession(clientDir),
            devTools: !app.isPackaged,
            preload: path.join(__dirname, '../preload/preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false
        }
    });

    if(initialBounds?.maximized) win.maximize();

    const emitWindowState = (): void => {
        sendToClient(win, 'window:state', { maximized: win.isMaximized() });
    };
    win.on('maximize', emitWindowState);
    win.on('unmaximize', emitWindowState);
    win.webContents.on('did-finish-load', emitWindowState);

    win.on('ready-to-show', () => win.show());
    void win.loadURL(`${CLIENT_ORIGIN}/dashboard`).catch(() => undefined);

    return win;
};

app.whenReady().then(async () => {
    const paths = resolveAppPaths();
    if(!existsSync(path.join(paths.clientDir, 'index.html'))){
        dialog.showErrorBox('Volt', `The web client is not built at ${paths.clientDir}. Build it with "pnpm --filter volt-webapp... build".`);
        app.quit();
        return;
    }

    for(const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => app.quit());

    const appConfig = new AppConfig({ configFile: paths.configFile });
    const win = createWindow(visibleBounds(await appConfig.getWindowBounds()), paths.clientDir);
    applyWindowSecurity(win);

    let persistTimer: NodeJS.Timeout | null = null;
    const persistBounds = (): void => {
        if(win.isDestroyed()) return;
        const normal = win.getNormalBounds();
        void appConfig.setWindowBounds({
            x: normal.x,
            y: normal.y,
            width: normal.width,
            height: normal.height,
            maximized: win.isMaximized()
        }).catch(() => {});
    };
    const schedulePersist = (): void => {
        if(persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(persistBounds, 400);
    };
    win.on('resize', schedulePersist);
    win.on('move', schedulePersist);
    win.on('maximize', schedulePersist);
    win.on('unmaximize', schedulePersist);
    win.on('close', () => {
        if(persistTimer) clearTimeout(persistTimer);
        persistBounds();
    });

    registerIpc(win);
    startAppUpdater();
    app.on('second-instance', () => {
        if(win.isMinimized()) win.restore();
        win.focus();
    });
});

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin') app.quit();
});
