import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'node:url';
import AppConfig, { WindowBounds } from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SourceResolver from '@/services/SourceResolver';
import Deploy from '@/services/Deploy';
import DockerPreflight from '@/services/DockerPreflight';
import RemoteProbe from '@/services/RemoteProbe';
import AppPaths from '@/services/AppPaths';
import bus from '@/services/EventBus';
import { registerIpc } from '@/ipc';

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Dev runs through electron-vite, which serves the renderer over HTTP and sets this.
const isDev = !!process.env['ELECTRON_RENDERER_URL'];

const MIN_WIDTH = 940;
const MIN_HEIGHT = 640;

if(!app.requestSingleInstanceLock()){
    app.quit();
    process.exit(0);
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const visualChrome = (): Electron.BrowserWindowConstructorOptions => {
    if(process.platform === 'darwin'){
        return { vibrancy: 'under-window', visualEffectState: 'active', roundedCorners: true, backgroundColor: '#00000000' };
    }
    if(process.platform === 'win32'){
        return { backgroundMaterial: 'acrylic', backgroundColor: '#00000000' };
    }
    return { transparent: true, backgroundColor: '#00000000' };
};

const loadShell = (win: BrowserWindow, hash?: string): void => {
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if(devUrl){
        win.loadURL(hash ? `${devUrl}#${hash}` : devUrl);
    }else{
        win.loadFile(path.join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined);
    }
};

// Drop a saved off-screen position (e.g. an external monitor that's now gone) so the
// window doesn't restore into the void; keep the size and let Electron re-center.
const visibleBounds = (bounds: WindowBounds | null): WindowBounds | null => {
    if(!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return bounds;
    const onScreen = screen.getAllDisplays().some((display) => {
        const area = display.workArea;
        return bounds.x! < area.x + area.width
            && bounds.x! + bounds.width > area.x
            && bounds.y! < area.y + area.height
            && bounds.y! + bounds.height > area.y;
    });
    return onScreen ? bounds : { width: bounds.width, height: bounds.height, maximized: bounds.maximized };
};

const createWindow = (initialBounds: WindowBounds | null): BrowserWindow => {
    const win = new BrowserWindow({
        width: Math.max(initialBounds?.width ?? 1600, MIN_WIDTH),
        height: Math.max(initialBounds?.height ?? 1000, MIN_HEIGHT),
        ...(typeof initialBounds?.x === 'number' ? { x: initialBounds.x } : {}),
        ...(typeof initialBounds?.y === 'number' ? { y: initialBounds.y } : {}),
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

    // Mirror the window's maximized state to the loaded page (shell or client) so it
    // can drop the rounded corners when maximized. Re-emitted on every load because
    // `loadURL` swaps the renderer (shell ↔ local/remote client).
    const emitWindowState = (): void => {
        if(!win.isDestroyed()) bus.emit('window:state', { maximized: win.isMaximized() });
    };
    win.on('maximize', emitWindowState);
    win.on('unmaximize', emitWindowState);

    // Recover gracefully when a handed-off client URL fails to load: a frameless
    // window would otherwise be stuck on a blank page with no titlebar controls.
    let recovering = false;
    win.webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
        if(!isMainFrame || errorCode === -3 || recovering) return; // -3 = ERR_ABORTED (superseded navigation)
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
    const paths = new AppPaths();

    const appConfig = new AppConfig({ configFile: paths.configFile });

    const sources = new SourceResolver({
        appConfig,
        downloadDir: paths.downloadDir,
        repos: [
            {
                repo: new Repository({ owner: 'voltlabs-research', repo: 'volt' }),
                envKey: 'VOLT_SOURCE_DIR'
            },
            {
                repo: new Repository({ owner: 'voltlabs-research', repo: 'clusterdaemon' }),
                envKey: 'CLUSTER_DAEMON_SOURCE_DIR'
            }
        ]
    });

    const docker = new DockerPreflight();

    const deploy = new Deploy({
        composeFile: paths.composeFile,
        appConfig,
        sources,
        docker
    });

    const remote = new RemoteProbe();

    const initialBounds = visibleBounds(await appConfig.getWindowBounds());
    const win = createWindow(initialBounds);

    // Persist window geometry (debounced) so size/position survive restarts.
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

    registerIpc(win, { deploy, appConfig, docker, remote, loadShell: (hash?: string) => loadShell(win, hash) });

    app.on('second-instance', () => {
        if(win.isMinimized()) win.restore();
        win.focus();
    });
});

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin') app.quit();
});
