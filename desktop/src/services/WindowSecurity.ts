import { shell } from 'electron';
import type { BrowserWindow } from 'electron';

/**
 * Navigation and window-opening policy for the shell window.
 *
 * The window is not a fixed-origin app: `app:openClient` navigates it to the VOLT
 * client, which with `remote.connect` can be any endpoint the user names. The
 * preload stays attached across that navigation, so without a policy the window
 * would follow any link a remote page offers, could spawn preload-bearing child
 * windows, and would keep receiving main-process events while showing a page that
 * is not ours.
 */

/** Schemes `shell.openExternal` may hand to the OS. */
const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const parseUrl = (value: string): URL | null => {
    try {
        return new URL(value);
    } catch {
        // A value the renderer supplied is not required to be a URL at all.
        return null;
    }
};

const shellUrlPrefix = (): string => process.env['ELECTRON_RENDERER_URL'] ?? 'file://';

/** True when `url` is the bundled shell (or the dev server standing in for it). */
export const isShellUrl = (url: string): boolean => {
    return url.length > 0 && url.startsWith(shellUrlPrefix());
};

export interface NavigationPolicy {
    /** Origins the window is allowed to navigate to, besides the shell itself. */
    allowedOrigins: () => Promise<readonly string[]>;
}

/**
 * Opens a URL in the user's browser, refusing anything outside
 * {@link EXTERNAL_SCHEMES}.
 *
 * Without the check, a `file:`, `smb:` or Windows UNC path reaching
 * `shell.openExternal` would ask the OS to open a local resource chosen by the
 * page.
 */
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

    // Any local port is the user's own stack; the port is chosen by config.
    if (url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname)) return true;

    return (await policy.allowedOrigins()).includes(url.origin);
};

export const applyWindowSecurity = (win: BrowserWindow, policy: NavigationPolicy): void => {
    /*
     * A child window would inherit this window's preload, so none is ever
     * created: an external link goes to the browser instead.
     */
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

    // Same rule for a redirect chain, which does not re-fire `will-navigate`.
    win.webContents.on('will-redirect', (event, url) => {
        void (async () => {
            if (await isAllowedNavigation(url, policy)) return;

            console.warn(`[security] blocked redirect to ${url}`);
            event.preventDefault();
        })();
    });
};

/**
 * Sends a main-process event only while the shell is the page in the window.
 *
 * `deploy:log` streams raw `docker compose` output from the user's machine. The
 * client page has no listener for it, and a remote page must not be able to
 * subscribe to it.
 */
export const sendToShell = <TPayload>(win: BrowserWindow, channel: string, payload: TPayload): void => {
    if (win.isDestroyed()) return;
    if (!isShellUrl(win.webContents.getURL())) return;

    win.webContents.send(channel, payload);
};
