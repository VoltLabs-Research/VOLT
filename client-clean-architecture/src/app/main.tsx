import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'reflect-metadata';

import App from './App';
import '@/shared/presentation/assets/stylesheets/theme.css';
import '@/shared/presentation/assets/stylesheets/base.css';
import '@/shared/presentation/assets/stylesheets/general.css';
import { ensureAuthDI } from '@/modules/auth/infrastructure/di/container';
import { ensureTeamDI } from '@/modules/team/infrastructure/di/container';
import { ensureTrajectoryDI } from '@/modules/trajectory/infrastructure/di/container';
import { ensureAnalysisDI } from '@/modules/analysis/infrastructure/di/container';
import { ensurePluginDI } from '@/modules/plugin/infrastructure/di/container';

// Registrar todas las dependencias
ensureAuthDI();
ensureTeamDI();
ensureTrajectoryDI();
ensureAnalysisDI();
ensurePluginDI();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
