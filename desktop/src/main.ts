import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'node:url';
import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SourceResolver from '@/services/SourceResolver';
import Deploy from '@/services/Deploy';
import { registerIpc } from '@/ipc';

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

if(!app.requestSingleInstanceLock()){
    app.quit();
    process.exit(0);
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const STACK_DEFAULTS: Record<string, string> = {
    SERVER_PORT: '8100',
    WEB_PORT: '5273',
    MINIO_PORT: '9100',
    MINIO_CONSOLE: '9101',
    DAEMON_PORT: '18080',
    MONGO_USER: 'volt',
    MONGO_PASS: 'volt',
    REDIS_PASS: 'voltredis',
    MINIO_USER: 'voltminio',
    MINIO_PASS: 'voltminiosecret',
    DAEMON_PASS: 'daemon-local-pass',
    SECRET_KEY: 'volt-local-secret',
    SSH_KEY: 'volt-local-ssh'
};

// Glass + rounded corners are native on macOS (vibrancy) and Windows (acrylic);
// on Linux there is no native blur, so we go transparent and let the renderer
// paint the rounded surface. Light/dark follows the system theme automatically:
// vibrancy/acrylic adapt to the OS appearance and the renderer honours
// prefers-color-scheme, so no extra theme wiring is needed here.
const visualChrome = (): Electron.BrowserWindowConstructorOptions => {
    if(process.platform === 'darwin'){
        return { vibrancy: 'under-window', visualEffectState: 'active', roundedCorners: true, backgroundColor: '#00000000' };
    }
    if(process.platform === 'win32'){
        return { backgroundMaterial: 'acrylic', backgroundColor: '#00000000' };
    }
    return { transparent: true, backgroundColor: '#00000000' };
};

const createWindow = (): BrowserWindow => {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
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

    win.on('ready-to-show', () => win.show());

    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if(devUrl){
        win.loadURL(devUrl);
    }else{
        win.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    return win;
};

app.whenReady().then(async () => {
    const appConfig = new AppConfig({ configFile: path.resolve('./app-config.json') });
    await appConfig.ensureStackDefaults(STACK_DEFAULTS);

    const sources = new SourceResolver({
        appConfig,
        downloadDir: path.resolve('./downloads'),
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

    const deploy = new Deploy({
        composeFile: path.resolve('./stack/compose.yml'),
        appConfig,
        sources
    });

    const win = createWindow();
    registerIpc(win, { deploy, appConfig });

    app.on('second-instance', () => {
        if(win.isMinimized()) win.restore();
        win.focus();
    });
});

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin') app.quit();
});
