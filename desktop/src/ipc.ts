import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import bus from '@/services/EventBus';
import { CHANNELS } from '@/types/events';
import Deploy from '@/services/Deploy';
import DockerPreflight from '@/services/DockerPreflight';
import AppConfig, { DevModeState, ThemePreference } from '@/services/AppConfig';
import RemoteProbe from '@/services/RemoteProbe';

export interface IpcDeps{
    deploy: Deploy;
    appConfig: AppConfig;
    docker: DockerPreflight;
    remote: RemoteProbe;
    loadShell: (hash?: string) => void;
};

export interface ConfirmOptions{
    title: string;
    message: string;
    detail?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

export const registerIpc = (win: BrowserWindow, deps: IpcDeps) => {
    // Docker-served local client, with a one-shot bootstrap token that seeds localStorage.
    const localClientUrl = async (): Promise<string> => {
        const env = await deps.appConfig.getStackEnv();
        const origin = `http://localhost:${env.WEB_PORT ?? '5273'}`;
        const token = (await deps.appConfig.getBootstrap())?.authToken;
        return token ? `${origin}/__bootstrap.html?token=${encodeURIComponent(token)}` : origin;
    };

    ipcMain.handle('deploy:start', () => deps.deploy.start());
    ipcMain.handle('deploy:stop', () => deps.deploy.stop());
    ipcMain.handle('deploy:reset', () => deps.deploy.resetAndRedeploy());

    ipcMain.handle('docker:preflight', () => deps.docker.preflight());

    ipcMain.handle('config:get', () => deps.appConfig.get());

    ipcMain.handle('remote:probe', (_e, endpoint: string) => deps.remote.probe(endpoint));

    ipcMain.handle('remote:connect', async (_e, endpoint: string) => {
        const result = await deps.remote.probe(endpoint);
        if(result.ok){
            await deps.appConfig.setDeployment({
                mode: 'remote',
                remote: { serverEndpoint: result.serverEndpoint, clientUrl: result.clientUrl }
            });
            await deps.appConfig.addRecentEndpoint(result.serverEndpoint).catch(() => {});
        }
        return result;
    });

    ipcMain.handle('remote:recent', () => deps.appConfig.getRecentEndpoints());

    ipcMain.handle('deployment:get', () => deps.appConfig.getDeployment());
    ipcMain.handle('deployment:setLocal', () => deps.appConfig.setDeployment({ mode: 'local' }));
    ipcMain.handle('deployment:reset', () => deps.appConfig.clearDeployment());

    ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));

    ipcMain.handle('dialog:pickDirectory', async () => {
        const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('dialog:confirm', async (_e, options: ConfirmOptions) => {
        const { response } = await dialog.showMessageBox(win, {
            type: options.danger ? 'warning' : 'question',
            buttons: [options.cancelLabel ?? 'Cancel', options.confirmLabel ?? 'Confirm'],
            defaultId: options.danger ? 0 : 1,
            cancelId: 0,
            title: options.title,
            message: options.message,
            detail: options.detail,
            noLink: true
        });
        return response === 1;
    });

    ipcMain.handle('theme:set', (_e, theme: ThemePreference) => deps.appConfig.setTheme(theme));

    ipcMain.handle('devmode:apply', (_e, payload: DevModeState) => deps.deploy.applyDevMode(payload));

    ipcMain.handle('window:minimize', () => win.minimize());
    ipcMain.handle('window:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
    ipcMain.handle('window:close', () => win.close());

    ipcMain.handle('app:voltUrl', () => localClientUrl());

    // Navigate the window to the deployed client: the Docker-served local client
    // (with a bootstrap token) or the remote deployment's advertised client URL.
    ipcMain.handle('app:openClient', async () => {
        const deployment = await deps.appConfig.getDeployment();
        const url = (deployment?.mode === 'remote' && deployment.remote)
            ? deployment.remote.clientUrl
            : await localClientUrl();
        void win.loadURL(url).catch(() => { /* superseded by a newer navigation */ });
    });

    ipcMain.handle('app:openShell', (_e, intent?: string) => {
        deps.loadShell(intent || 'launcher');
    });

    const unsubs = CHANNELS.map((event) =>
        bus.on(event, (payload) => {
            if(!win.isDestroyed()) win.webContents.send(event, payload);
        })
    );

    win.on('closed', () => unsubs.forEach((u) => u()));
};
