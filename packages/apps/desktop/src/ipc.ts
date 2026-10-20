import { ipcMain, dialog, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import bus from '@/services/EventBus';
import { CHANNELS } from '@/types/events';
import LocalDeploy from '@/services/LocalDeploy';
import AppConfig, { DevModeState, ThemePreference } from '@/services/AppConfig';
import { isTrustedChromeUrl, openExternalUrl, sendToShell } from '@/services/WindowSecurity';
import type { ConfirmOptions } from '@/types/global';

interface IpcDeps{
    deploy: LocalDeploy;
    appConfig: AppConfig;
    loadShell: (hash?: string) => void;
    allowedOrigins: () => Promise<readonly string[]>;
};

const senderUrlOf = (event: IpcMainInvokeEvent): string => event.senderFrame?.url ?? '';

const isShellSender = (event: IpcMainInvokeEvent): boolean => {
    const senderUrl = senderUrlOf(event);
    if(!senderUrl) return false;

    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if(devUrl) return senderUrl.startsWith(devUrl);

    return senderUrl.startsWith('file://');
};

const handleFromShell = <TResult>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: never[]) => TResult
): void => {
    ipcMain.handle(channel, (event, ...args) => {
        if(!isShellSender(event)){
            throw new Error(`Channel ${channel} is only available to the Volt shell`);
        }

        return handler(event, ...args as never[]);
    });
};

const handleFromTrusted = <TResult>(
    channel: string,
    allowedOrigins: () => Promise<readonly string[]>,
    handler: (event: IpcMainInvokeEvent, ...args: never[]) => TResult
): void => {
    ipcMain.handle(channel, async (event, ...args) => {
        if(!isTrustedChromeUrl(senderUrlOf(event), await allowedOrigins())){
            throw new Error(`Channel ${channel} is only available to the Volt window`);
        }

        return handler(event, ...args as never[]);
    });
};

export const registerIpc = (win: BrowserWindow, deps: IpcDeps) => {
    handleFromShell('deploy:start', () => deps.deploy.start());
    handleFromShell('deploy:stop', () => deps.deploy.stop());
    handleFromShell('deploy:reset', () => deps.deploy.resetAndRedeploy());

    handleFromShell('config:get', () => deps.appConfig.get());

    handleFromTrusted('shell:openExternal', deps.allowedOrigins, (_e, url: string) => openExternalUrl(url));

    handleFromShell('dialog:pickDirectory', async () => {
        const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    handleFromShell('dialog:confirm', async (_e, options: ConfirmOptions) => {
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

    handleFromShell('theme:set', (_e, theme: ThemePreference) => deps.appConfig.setTheme(theme));

    handleFromShell('devmode:apply', (_e, payload: DevModeState) => deps.deploy.applyDevMode(payload));

    handleFromTrusted('window:minimize', deps.allowedOrigins, () => win.minimize());
    handleFromTrusted('window:maximize', deps.allowedOrigins, () => win.isMaximized() ? win.unmaximize() : win.maximize());
    handleFromTrusted('window:close', deps.allowedOrigins, () => win.close());

    handleFromShell('app:openClient', async () => {
        const url = await deps.deploy.clientUrl();
        if(!url){
            deps.loadShell('launcher');
            return;
        }
        void win.loadURL(url).catch(() => { });
    });

    handleFromTrusted('app:openShell', deps.allowedOrigins, (_e, intent?: string) => {
        deps.loadShell(intent || 'launcher');
    });

    const unsubs = CHANNELS.map((event) =>
        bus.on(event, (payload) => {
            sendToShell(win, event, payload);
        })
    );

    win.on('closed', () => unsubs.forEach((u) => u()));
};
