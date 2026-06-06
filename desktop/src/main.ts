import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'node:url';
import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import Deploy from '@/services/Deploy';
import { registerIpc } from '@/ipc';

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Single instance: a second process on the same userData can't open IndexedDB
// (LevelDB holds an exclusive lock) and the renderer would crash.
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

const createWindow = (): BrowserWindow => {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        frame: false,
        backgroundColor: '#ffffff',
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

    const deploy = new Deploy({
        composeFile: path.resolve('./stack/compose.yml'),
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
