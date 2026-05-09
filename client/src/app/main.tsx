import '@/shared/presentation/assets/stylesheets/fonts.css';
import '@/shared/presentation/assets/stylesheets/theme.css';
import '@/shared/presentation/assets/stylesheets/base.css';
import '@/shared/presentation/assets/stylesheets/general.css';
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

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
