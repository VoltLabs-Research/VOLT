import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'reflect-metadata';

import App from './App';
import '@/shared/presentation/assets/stylesheets/theme.css';
import '@/shared/presentation/assets/stylesheets/base.css';
import '@/shared/presentation/assets/stylesheets/general.css';
import { ensureAuthDI } from '@/modules/auth/infrastructure/di/container';

ensureAuthDI();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
