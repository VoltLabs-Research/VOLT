import '@/shared/presentation/assets/stylesheets/fonts.css';
import '@/shared/presentation/assets/stylesheets/theme.css';
import '@/shared/presentation/assets/stylesheets/base.css';
import '@/shared/presentation/assets/stylesheets/general.css';
import '@voltstack/bravais/components.css';
import { initializeCustomScrollbars } from '@/shared/presentation/utilities/custom-scrollbars';
import App from './App';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const scheduleDeferred = (task: () => void) => {
    const requestIdle = window.requestIdleCallback;
    if (typeof requestIdle === 'function') {
        requestIdle(() => task(), { timeout: 1200 });
        return;
    }

    window.setTimeout(task, 250);
};

scheduleDeferred(() => {
    void import('invokers-polyfill');
});

initializeCustomScrollbars();

// When hosted by the Volt desktop shell, flag the document so the headers opt into
// window-drag/controls styling and the window corners round (see base.css).
//
// We detect the shell via the Electron user agent rather than `window.volt` because the
// desktop's preload is an ES module, which Electron exposes ASYNCHRONOUSLY — when the
// client is opened via `loadURL`, `window.volt` is frequently undefined at the time this
// entry module runs, so a synchronous `window.volt` check would miss it and leave the
// window square. The UA is available synchronously regardless of preload timing.
type VoltBridge = { on?: (channel: string, cb: (payload: { maximized: boolean }) => void) => () => void };
const readVoltBridge = (): VoltBridge | undefined => (window as unknown as { volt?: VoltBridge }).volt;

if (navigator.userAgent.includes('Electron') || readVoltBridge()) {
    document.documentElement.dataset.voltDesktop = 'true';

    const applyMaximizedState = (maximized: boolean): void => {
        if (maximized) {
            document.documentElement.dataset.voltMaximized = 'true';
        } else {
            delete document.documentElement.dataset.voltMaximized;
        }
    };

    // Flatten the rounded corners while maximized. The bridge may land after this module
    // (ESM preload), so wire it as soon as it appears, then stop polling.
    const wireWindowState = (): boolean => {
        const volt = readVoltBridge();
        if (!volt?.on) {
            return false;
        }

        volt.on('window:state', ({ maximized }) => applyMaximizedState(maximized));
        return true;
    };

    if (!wireWindowState()) {
        const pollId = window.setInterval(() => {
            if (wireWindowState()) {
                window.clearInterval(pollId);
            }
        }, 50);
        window.setTimeout(() => window.clearInterval(pollId), 3000);
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
