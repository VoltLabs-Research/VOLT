
import '@/shared/ui/assets/stylesheets/fonts.css';

import '@/shared/ui/assets/stylesheets/index.css';
import { requestIdleCallbackHandle } from '@/shared/ui/utils/idle-callback';
import App from './App';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

requestIdleCallbackHandle(() => {
    void import('invokers-polyfill');
}, {
    timeoutMs: 1200,
    fallbackDelayMs: 250
});

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
