import { shell } from 'electron';
import type { BrowserWindow } from 'electron';

const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const parseUrl = (value: string): URL | null => {
    try {
        return new URL(value);
    } catch {
        return null;
    }
};

const shellUrlPrefix = (): string => process.env['ELECTRON_RENDERER_URL'] ?? 'file://';

const isShellUrl = (url: string): boolean => {
    return url.length > 0 && url.startsWith(shellUrlPrefix());
};

interface NavigationPolicy {
    allowedOrigins: () => Promise<readonly string[]>;
}

export const openExternalUrl = async (value: string): Promise<boolean> => {
    const url = parseUrl(value);
    if (!url || !EXTERNAL_SCHEMES.has(url.protocol)) {
        console.warn(`[security] refused to open external URL with disallowed scheme: ${value}`);
        return false;
    }

    await shell.openExternal(url.href);
    return true;
};

const isAllowedNavigation = async (target: string, policy: NavigationPolicy): Promise<boolean> => {
    if (isShellUrl(target)) return true;

    const url = parseUrl(target);
    if (!url) return false;

    if (url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname)) return true;

    return (await policy.allowedOrigins()).includes(url.origin);
};

export const applyWindowSecurity = (win: BrowserWindow, policy: NavigationPolicy): void => {
    win.webContents.setWindowOpenHandler(({ url }) => {
        void openExternalUrl(url);
        return { action: 'deny' };
    });

    win.webContents.on('will-navigate', (event, url) => {
        void (async () => {
            if (await isAllowedNavigation(url, policy)) return;

            console.warn(`[security] blocked navigation to ${url}`);
            event.preventDefault();
        })();
    });

    win.webContents.on('will-redirect', (event, url) => {
        void (async () => {
            if (await isAllowedNavigation(url, policy)) return;

            console.warn(`[security] blocked redirect to ${url}`);
            event.preventDefault();
        })();
    });
};

export const sendToShell = <TPayload>(win: BrowserWindow, channel: string, payload: TPayload): void => {
    if (win.isDestroyed()) return;
    if (!isShellUrl(win.webContents.getURL())) return;

    win.webContents.send(channel, payload);
};
