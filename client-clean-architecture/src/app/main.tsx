import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'reflect-metadata';

import App from './App';
import '@/shared/presentation/assets/stylesheets/theme.css';
import '@/shared/presentation/assets/stylesheets/base.css';
import '@/shared/presentation/assets/stylesheets/general.css';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import { ensureAuthDI } from '@/modules/auth/infrastructure/di/container';
import { ensureTeamDI } from '@/modules/team/infrastructure/di/container';
import { ensureTrajectoryDI } from '@/modules/trajectory/infrastructure/di/container';
import { ensureAnalysisDI } from '@/modules/analysis/infrastructure/di/container';

useAuthStore.getState().initializeAuth();
ensureAuthDI();
ensureTeamDI();
ensureTrajectoryDI();
ensureAnalysisDI();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
