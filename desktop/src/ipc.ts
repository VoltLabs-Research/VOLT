import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import bus from '@/services/EventBus';
import { CHANNELS } from '@/types/events';
import Deploy from '@/services/Deploy';
import DockerPreflight from '@/services/DockerPreflight';
import AppConfig, { DevModeState } from '@/services/AppConfig';
import RemoteProbe from '@/services/RemoteProbe';

export interface IpcDeps{
    deploy: Deploy;
    appConfig: AppConfig;
    docker: DockerPreflight;
    remote: RemoteProbe;
};

export const registerIpc = (win: BrowserWindow, deps: IpcDeps) => {
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
        }
        return result;
    });

    ipcMain.handle('deployment:get', () => deps.appConfig.getDeployment());
    ipcMain.handle('deployment:setLocal', () => deps.appConfig.setDeployment({ mode: 'local' }));
    ipcMain.handle('deployment:reset', () => deps.appConfig.clearDeployment());

    ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));

    ipcMain.handle('dialog:pickDirectory', async () => {
        const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('devmode:apply', (_e, payload: DevModeState) => deps.deploy.applyDevMode(payload));

    ipcMain.handle('window:minimize', () => win.minimize());
    ipcMain.handle('window:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
    ipcMain.handle('window:close', () => win.close());

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

    const unsubs = CHANNELS.map((event) =>
        bus.on(event, (payload) => {
            if(!win.isDestroyed()) win.webContents.send(event, payload);
        })
    );

    win.on('closed', () => unsubs.forEach((u) => u()));
};
