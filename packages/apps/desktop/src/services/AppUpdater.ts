import { app, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import electronUpdater, { NsisUpdater, type AppUpdater } from 'electron-updater';
import { isNewerVersion, normalizeVersion, pickLatestVoltRelease, VOLT_RELEASES_API } from '@volt/contracts/modules/system/releases';
import type { GithubReleaseSummary } from '@volt/contracts/modules/system/releases';
import type { DesktopUpdateState } from '@volt/contracts/modules/system/domain';
import { sendToClient } from '@/services/WindowSecurity';

const CHECK_DELAY_MS = 3_000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const UPDATE_STATE_CHANNEL = 'app:update:state';

const getAutoUpdater = (): AppUpdater => {
    const { autoUpdater } = electronUpdater;
    return autoUpdater;
};

// electron-updater replaces the app itself only from the Windows installer and an AppImage.
// Everywhere else the app can only say a new release is out and where to get it.
const canSelfUpdate = (): boolean => {
    if(process.platform === 'win32') return true;
    if(process.platform === 'linux') return Boolean(process.env.APPIMAGE);
    return false;
};

const errorText = (error: unknown): string =>
    error instanceof Error ? error.stack ?? error.message : String(error);

// The update's state, kept here so a page that loads after an event still sees it.
class DesktopUpdates{
    #state: DesktopUpdateState = { status: 'idle' };
    #win: BrowserWindow | null = null;

    get state(): DesktopUpdateState{
        return this.#state;
    }

    attach(win: BrowserWindow): void{
        this.#win = win;
        win.webContents.on('did-finish-load', () => this.#publish());
    }

    set(next: DesktopUpdateState): void{
        this.#state = next;
        this.#publish();
    }

    #publish(): void{
        if(this.#win) sendToClient(this.#win, UPDATE_STATE_CHANNEL, this.#state);
    }
}

export const desktopUpdates = new DesktopUpdates();

// Restarts into the downloaded version, or opens the release page where the app cannot update itself.
export const applyDesktopUpdate = async (): Promise<void> => {
    const state = desktopUpdates.state;
    if(state.status === 'ready'){
        getAutoUpdater().quitAndInstall(false, true);
        return;
    }
    if(state.status === 'manual'){
        await shell.openExternal(state.url);
    }
};

const startSelfUpdates = (): void => {
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

    let pendingVersion = '';
    updater.on('update-available', (info) => {
        pendingVersion = normalizeVersion(info.version);
        desktopUpdates.set({
            status: 'downloading',
            version: pendingVersion,
            percent: 0
        });
    });
    updater.on('download-progress', (progress) => {
        if(!pendingVersion) return;
        desktopUpdates.set({
            status: 'downloading',
            version: pendingVersion,
            percent: Math.round(progress.percent)
        });
    });
    updater.on('update-downloaded', (info) => {
        desktopUpdates.set({
            status: 'ready',
            version: normalizeVersion(info.version)
        });
    });
    updater.on('error', (error) => {
        console.error('[updater]', errorText(error));
        // A failed download is retried on the next check; until then the bar has nothing to offer.
        if(desktopUpdates.state.status === 'downloading') desktopUpdates.set({ status: 'idle' });
    });

    const check = (): void => {
        // A downloaded update waits for the restart; checking again would download nothing new.
        if(desktopUpdates.state.status === 'ready') return;
        void updater.checkForUpdates().catch((error: unknown) => {
            console.error('[updater] check failed:', errorText(error));
        });
    };

    setTimeout(check, CHECK_DELAY_MS);
    setInterval(check, RECHECK_INTERVAL_MS);
};

// Compares this build with the newest VOLT release on GitHub, for the platforms that download it by hand.
const startManualChecks = (): void => {
    const check = async (): Promise<void> => {
        try{
            const response = await fetch(VOLT_RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
            if(!response.ok) return;
            const latest = pickLatestVoltRelease(await response.json() as GithubReleaseSummary[]);
            if(!latest || !isNewerVersion(latest.tag_name, app.getVersion())) return;
            desktopUpdates.set({
                status: 'manual',
                version: normalizeVersion(latest.tag_name),
                url: latest.html_url
            });
        }catch(error){
            console.error('[updater] release check failed:', errorText(error));
        }
    };

    setTimeout(() => void check(), CHECK_DELAY_MS);
    setInterval(() => void check(), RECHECK_INTERVAL_MS);
};

export const startAppUpdater = (win: BrowserWindow): void => {
    desktopUpdates.attach(win);
    if(!app.isPackaged) return;

    if(canSelfUpdate()) startSelfUpdates();
    else startManualChecks();
};
