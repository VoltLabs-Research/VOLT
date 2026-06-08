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

// When hosted by the Volt desktop shell the preload injects `window.volt`; flag the
// document so the headers opt into window-drag/controls styling (no-op in a browser).
if ((window as unknown as { volt?: unknown }).volt) {
    document.documentElement.dataset.voltDesktop = 'true';
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
