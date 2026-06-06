import { ipcMain, dialog, BrowserWindow } from 'electron';
import bus, { AppEvents } from '@/services/EventBus';
import Deploy from '@/services/Deploy';
import AppConfig, { DevModeState } from '@/services/AppConfig';
import { assertDevPaths } from '@/services/devPaths';

export interface IpcDeps{
    deploy: Deploy;
    appConfig: AppConfig;
};

const FORWARDED: (keyof AppEvents)[] = ['deploy:log', 'deploy:state', 'source:progress', 'deploy:phases', 'deploy:phase'];

const sourcesChanged = (prev: Partial<DevModeState> | undefined, next: DevModeState) =>
    prev?.enabled !== next.enabled ||
    prev?.voltPath !== next.voltPath ||
    prev?.clusterDaemonPath !== next.clusterDaemonPath;

export const registerIpc = (win: BrowserWindow, deps: IpcDeps) => {
    ipcMain.handle('deploy:start', () => deps.deploy.start());
    ipcMain.handle('deploy:stop',  () => deps.deploy.stop());

    ipcMain.handle('config:get',    () => deps.appConfig.get());
    ipcMain.handle('config:update', (_e, payload: object) => deps.appConfig.update(payload));

    ipcMain.handle('dialog:pickDirectory', async () => {
        const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    // Surfaces a failure on the deploy:state channel the boot screen already
    // listens to. Used only for the steps that don't run through Deploy's
    // #runStage (which self-reports), so every failure toasts exactly once.
    const reportPre = async <T>(fn: () => Promise<T>): Promise<T> => {
        try{
            return await fn();
        }catch(err: any){
            bus.emit('deploy:state', { state: 'error', message: err?.message ?? String(err) });
            throw err;
        }
    };

    // Switch between release and local-source (dev) mode. Tear down whatever is
    // running first so start() rebuilds from the new sources instead of reusing
    // the live containers, then persist the choice and bring the stack back up.
    ipcMain.handle('devmode:apply', async (_e, payload: DevModeState) => {
        const previous = await reportPre(async () => {
            if(payload.enabled) assertDevPaths(payload.voltPath, payload.clusterDaemonPath);
            return (await deps.appConfig.get()).devMode as Partial<DevModeState> | undefined;
        });

        // Only a source switch needs a teardown. The node_modules named volumes are
        // seeded from the image on first creation, so a new checkout would run against
        // the prior one's deps; dropping them forces a reseed, and `volume rm` needs the
        // containers gone first. A plain redeploy of the same sources skips all of this:
        // start()'s `up --build` rebuilds the images and recreates only the changed
        // services, leaving the healthy mongo/redis/minio (and their data) untouched.
        if(sourcesChanged(previous, payload)){
            await deps.deploy.stop();
            await reportPre(() => deps.deploy.resetDepsVolumes());
        }

        await reportPre(() => deps.appConfig.setDevMode(payload));
        await deps.deploy.start();
    });

    ipcMain.handle('window:minimize', () => win.minimize());
    ipcMain.handle('window:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
    ipcMain.handle('window:close',    () => win.close());

    ipcMain.handle('app:voltUrl', async () => {
        const env = await deps.appConfig.getStackEnv();
        const origin = `http://localhost:${env.WEB_PORT}`;

        const bootstrap = await deps.appConfig.getBootstrap();
        if(bootstrap?.authToken){
            const token = encodeURIComponent(bootstrap.authToken);
            return `${origin}/__bootstrap.html?token=${token}`;
        }
        return origin;
    });

    const unsubs = FORWARDED.map((event) =>
        bus.on(event, (payload) => {
            if(!win.isDestroyed()) win.webContents.send(event, payload);
        })
    );

    win.on('closed', () => unsubs.forEach((u) => u()));
};
