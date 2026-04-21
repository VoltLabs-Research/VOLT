import '@/shared/presentation/assets/stylesheets/theme.css';
import '@/shared/presentation/assets/stylesheets/base.css';
import '@/shared/presentation/assets/stylesheets/general.css';
import '@/modules/socket/core/services/socket-service';
import { initializeTheme } from '@/shared/presentation/hooks/use-theme';
import App from './App';

import 'invokers-polyfill';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

initializeTheme();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
