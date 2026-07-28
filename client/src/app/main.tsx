import '@/shared/ui/assets/stylesheets/fonts.css';
import '@/shared/ui/assets/stylesheets/theme.css';
import '@/shared/ui/assets/stylesheets/base.css';
import '@/shared/ui/assets/stylesheets/general.css';
import '@voltstack/bravais/components.css';
import { initializeCustomScrollbars } from '@/shared/ui/utils/custom-scrollbars';
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
