import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'reflect-metadata';

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import App from './App';
import '@/shared/presentation/assets/stylesheets/theme.css';
import '@/shared/presentation/assets/stylesheets/base.css';
import '@/shared/presentation/assets/stylesheets/general.css';
import { ensureAuthDI } from '@/modules/auth/infrastructure/di/container';
import { ensureTeamDI } from '@/modules/team/infrastructure/di/container';
import { ensureTrajectoryDI } from '@/modules/trajectory/infrastructure/di/container';
import { ensureAnalysisDI } from '@/modules/analysis/infrastructure/di/container';
import { ensurePluginDI } from '@/modules/plugin/infrastructure/di/container';
import { ensureNotificationDI } from '@/modules/notification/infrastructure/di/container';
import { ensureDailyActivityDI } from '@/modules/daily-activity/infrastructure/di/container';
import { ensureSocketDI } from '@/modules/socket/infrastructure/di/container';
import { ensureSimulationCellDI } from '@/modules/simulation-cell/infrastructure/di/container';
import { ensureContainerDI } from '@/modules/container/infrastructure/di/container';
import { ensureSSHDI } from '@/modules/ssh/infrastructure/di/container';

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'json') {
            return new jsonWorker();
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
            return new cssWorker();
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
            return new htmlWorker();
        }
        if (label === 'typescript' || label === 'javascript') {
            return new tsWorker();
        }
        return new editorWorker();
    },
};

loader.config({ monaco });

// Register all dependencies
ensureAuthDI();
ensureSocketDI(); // Must be after auth (needs token storage)
ensureTeamDI();
ensureTrajectoryDI();
ensureAnalysisDI();
ensurePluginDI();
ensureNotificationDI();
ensureDailyActivityDI();
ensureSimulationCellDI();
ensureContainerDI();
ensureSSHDI();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
