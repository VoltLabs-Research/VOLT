import '@/shared/ui/assets/stylesheets/fonts.css';
/* Design tokens and utility classes come from bravais, which owns them. The app
   used to ship a copy of both sheets; the copy had already drifted behind. */
import '@voltstack/bravais/styles.css';
/* Rebases bravais's tokens into VOLT's identity. Must follow the sheet it rebases. */
import '@/shared/ui/assets/stylesheets/identity.css';
/* Stands exactly where bravais's own utility sheet used to, so a component's
   CSS still wins over a utility passed through className. See the file header. */
import '@/shared/ui/assets/stylesheets/tailwind.css';
import '@/shared/ui/assets/stylesheets/base.css';
import '@voltstack/bravais/components.css';
import { initializeCustomScrollbars } from '@/shared/ui/utils/custom-scrollbars';
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
