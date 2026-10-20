import { app } from 'electron';
import electronUpdater, { NsisUpdater, type AppUpdater } from 'electron-updater';

const CHECK_DELAY_MS = 3_000;

const getAutoUpdater = (): AppUpdater => {
    const { autoUpdater } = electronUpdater;
    return autoUpdater;
};

const isSupported = (): boolean => {
    if(!app.isPackaged) return false;
    if(process.platform === 'win32') return true;
    if(process.platform === 'linux') return Boolean(process.env.APPIMAGE);
    return false;
};

export const startAppUpdater = (): void => {
    if(!isSupported()) return;

    const updater = getAutoUpdater();
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.disableWebInstaller = true;
    if(updater instanceof NsisUpdater) updater.verifyUpdateCodeSignature = async () => null;
    updater.logger = {
        info: (message) => console.info('[updater]', message),
        warn: (message) => console.warn('[updater]', message),
        error: (message) => console.error('[updater]', message),
        debug: (message) => console.debug('[updater]', message)
    };
    updater.on('error', (error) => {
        console.error('[updater]', error.stack ?? error.message);
    });

    setTimeout(() => {
        void updater.checkForUpdatesAndNotify().catch((error: unknown) => {
            console.error('[updater] check failed:', error instanceof Error ? error.stack ?? error.message : error);
        });
    }, CHECK_DELAY_MS);
};
