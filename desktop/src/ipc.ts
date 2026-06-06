import { ipcMain, BrowserWindow } from 'electron';
import bus, { AppEvents } from '@/services/EventBus';
import Deploy from '@/services/Deploy';
import AppConfig from '@/services/AppConfig';

export interface IpcDeps{
    deploy: Deploy;
    appConfig: AppConfig;
};

const FORWARDED: (keyof AppEvents)[] = ['deploy:log', 'deploy:state', 'source:progress'];

export const registerIpc = (win: BrowserWindow, deps: IpcDeps) => {
    ipcMain.handle('deploy:start', deps.deploy.start);
    ipcMain.handle('deploy:stop', deps.deploy.stop);
    
    ipcMain.handle('config:get', deps.appConfig.get);
    ipcMain.handle('config:update', (_e, payload: object) => deps.appConfig.update(payload));

    const unsubs = FORWARDED.map((event) =>
        bus.on(event, (payload) => {
            if(!win.isDestroyed()) win.webContents.send(event, payload);
        })
    );

    win.on('closed', () => unsubs.forEach((u) => u()));
};