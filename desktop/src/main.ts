import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'node:url';
import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SourceResolver from '@/services/SourceResolver';
import Deploy from '@/services/Deploy';
import DockerPreflight from '@/services/DockerPreflight';
import RemoteProbe from '@/services/RemoteProbe';
import AppPaths from '@/services/AppPaths';
import { registerIpc } from '@/ipc';

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

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

const createWindow = (): BrowserWindow => {
    const win = new BrowserWindow({
        width: 1600,
        height: 1000,
        show: false,
        frame: false,
        ...visualChrome(),
        webPreferences: {
            devTools: true,
            preload: path.join(__dirname, '../preload/preload.mjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.webContents.openDevTools({ mode: 'detach' });

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

    const win = createWindow();
    registerIpc(win, { deploy, appConfig, docker, remote, loadShell: (hash?: string) => loadShell(win, hash) });

    app.on('second-instance', () => {
        if(win.isMinimized()) win.restore();
        win.focus();
    });
});

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin') app.quit();
});
