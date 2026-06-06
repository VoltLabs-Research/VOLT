import { ipcMain, BrowserWindow } from 'electron';
import bus, { AppEvents } from '@/services/EventBus';
import Deploy from '@/services/Deploy';
import AppConfig from '@/services/AppConfig';

export interface IpcDeps{
    deploy: Deploy;
    appConfig: AppConfig;
};

const FORWARDED: (keyof AppEvents)[] = ['deploy:log', 'deploy:state', 'source:progress'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const waitForUrl = async (url: string, timeoutMs = 60000) => {
    const deadline = Date.now() + timeoutMs;
    while(Date.now() < deadline){
        try{
            const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
            if(res.ok) return;
        }catch{ /* not ready yet */ }
        await sleep(500);
    }
    throw new Error(`Timeout waiting for ${url}`);
};

export const registerIpc = (win: BrowserWindow, deps: IpcDeps) => {
    ipcMain.handle('deploy:start', () => deps.deploy.start());
    ipcMain.handle('deploy:stop',  () => deps.deploy.stop());

    ipcMain.handle('config:get',    () => deps.appConfig.get());
    ipcMain.handle('config:update', (_e, payload: object) => deps.appConfig.update(payload));

    ipcMain.handle('app:voltUrl', async () => {
        const env = await deps.appConfig.getStackEnv();
        const port = env.WEB_PORT ?? '5273';
        const origin = `http://localhost:${port}`;
        await waitForUrl(origin);

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
