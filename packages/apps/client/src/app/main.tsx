
import '@/shared/ui/assets/stylesheets/fonts.css';

import '@/shared/ui/assets/stylesheets/index.css';
import { requestIdleCallbackHandle } from '@/shared/ui/utils/idle-callback';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import App from './App';
import { CornerWindowControls } from '@/shared/ui/components/WindowControls';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

requestIdleCallbackHandle(() => {
    void import('invokers-polyfill');
}, {
    timeoutMs: 1200,
    fallbackDelayMs: 250
});

type VoltBridge = { on?: (channel: string, cb: (payload: { maximized: boolean }) => void) => () => void };
// The desktop app's preload exposes it before the page's scripts run.
const voltBridge = (window as unknown as { volt?: VoltBridge }).volt;

if (navigator.userAgent.includes('Electron') || voltBridge) {
    document.documentElement.dataset.voltDesktop = 'true';

    voltBridge?.on?.('window:state', ({ maximized }) => {
        if (maximized) {
            document.documentElement.dataset.voltMaximized = 'true';
        } else {
            delete document.documentElement.dataset.voltMaximized;
        }
    });
}

const root = createRoot(document.getElementById('root')!);

const renderApp = (): void => {
    root.render(
        <StrictMode>
            <App />
            <CornerWindowControls />
        </StrictMode>
    );
};

// A browser running its own VOLT starts it before the app talks to it.
if (localStackMode.isEnabled()) {
    void import('@/modules/local-stack/components/LocalStackBoot').then(({ default: LocalStackBoot }) => {
        root.render(
            <>
                <LocalStackBoot onReady={renderApp} />
                <CornerWindowControls />
            </>
        );
    });
} else {
    renderApp();
}
