import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'node:url';
import AppConfig, { WindowBounds } from '@/services/AppConfig';
import LocalDeploy from '@/services/LocalDeploy';
import { resolveAppPaths } from '@/services/AppPaths';
import bus from '@/services/EventBus';
import { applyWindowSecurity } from '@/services/WindowSecurity';
import { registerIpc } from '@/ipc';

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const isDev = !!process.env['ELECTRON_RENDERER_URL'];

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
            backgroundMaterial: 'acrylic',
            backgroundColor: '#00000000'
        };
    }
    return {
        transparent: true,
        backgroundColor: '#00000000'
    };
};

const loadShell = (win: BrowserWindow, hash?: string): void => {
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    const navigation = devUrl
        ? win.loadURL(hash ? `${devUrl}#${hash}` : devUrl)
        : win.loadFile(path.join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined);

    void navigation.catch(() => undefined);
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

const createWindow = (initialBounds: WindowBounds | null): BrowserWindow => {
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
            devTools: isDev,
            preload: path.join(__dirname, '../preload/preload.mjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    if(initialBounds?.maximized) win.maximize();
    if(isDev) win.webContents.openDevTools({ mode: 'detach' });

    const emitWindowState = (): void => {
        if(!win.isDestroyed()) bus.emit('window:state', { maximized: win.isMaximized() });
    };
    win.on('maximize', emitWindowState);
    win.on('unmaximize', emitWindowState);

    let recovering = false;
    win.webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
        if(!isMainFrame || errorCode === -3 || recovering) return; 
        recovering = true;
        loadShell(win, 'client-error');
    });
    win.webContents.on('did-finish-load', () => {
        recovering = false;
        emitWindowState();
    });

    win.on('ready-to-show', () => win.show());
    loadShell(win);

    return win;
};

app.whenReady().then(async () => {
    const paths = resolveAppPaths();

    const appConfig = new AppConfig({ configFile: paths.configFile });

    const deploy = new LocalDeploy({
        appConfig,
        paths: {
            runtimeDir: paths.runtimeDir,
            stackDataDir: paths.stackDataDir,
            logsDir: paths.logsDir
        }
    });

    for(const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => app.quit());

    let quitting = false;
    app.on('before-quit', (event) => {
        if(quitting) return;
        quitting = true;
        event.preventDefault();
        deploy.stop().catch(() => {}).finally(() => app.exit(0));
    });

    const initialBounds = visibleBounds(await appConfig.getWindowBounds());
    const win = createWindow(initialBounds);

    applyWindowSecurity(win, {
        allowedOrigins: async () => {
            const deployment = await appConfig.getDeployment();
            const remoteClientUrl = deployment?.mode === 'remote' ? deployment.remote?.clientUrl : undefined;
            if(!remoteClientUrl) return [];

            try{
                return [new URL(remoteClientUrl).origin];
            }catch{
                return [];
            }
        }
    });

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

    registerIpc(win, {
        deploy,
        appConfig,
        loadShell: (hash?: string) => loadShell(win, hash)
    });
    app.on('second-instance', () => {
        if(win.isMinimized()) win.restore();
        win.focus();
    });
});

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin') app.quit();
});
