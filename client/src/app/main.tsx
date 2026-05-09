import '@/shared/presentation/assets/stylesheets/fonts.css';
import '@/shared/presentation/assets/stylesheets/theme.css';
import '@/shared/presentation/assets/stylesheets/base.css';
import '@/shared/presentation/assets/stylesheets/general.css';
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

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
