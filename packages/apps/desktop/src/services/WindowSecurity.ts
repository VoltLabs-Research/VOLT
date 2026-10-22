import { shell } from 'electron';
import type { BrowserWindow } from 'electron';
import { CLIENT_ORIGIN } from '@/services/ClientProtocol';

const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

const parseUrl = (value: string): URL | null => {
    try{
        return new URL(value);
    }catch{
        return null;
    }
};

export const isClientUrl = (value: string): boolean => parseUrl(value)?.origin === CLIENT_ORIGIN;

const openExternalUrl = async (value: string): Promise<void> => {
    const url = parseUrl(value);
    if(!url || !EXTERNAL_SCHEMES.has(url.protocol) || url.origin === CLIENT_ORIGIN){
        console.warn(`[security] refused to open external URL: ${value}`);
        return;
    }

    await shell.openExternal(url.href);
};

// The window shows the client and nothing else: links to other places open in the system browser.
export const applyWindowSecurity = (win: BrowserWindow): void => {
    win.webContents.setWindowOpenHandler(({ url }) => {
        void openExternalUrl(url);
        return { action: 'deny' };
    });

    win.webContents.on('will-navigate', (event, url) => {
        if(isClientUrl(url)) return;
        event.preventDefault();
        void openExternalUrl(url);
    });

    win.webContents.on('will-redirect', (event, url) => {
        if(isClientUrl(url)) return;
        console.warn(`[security] blocked redirect to ${url}`);
        event.preventDefault();
    });
};

export const sendToClient = <TPayload>(win: BrowserWindow, channel: string, payload: TPayload): void => {
    if(win.isDestroyed()) return;
    if(!isClientUrl(win.webContents.getURL())) return;

    win.webContents.send(channel, payload);
};
