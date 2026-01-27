import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from '@/app/App'
import { registerModuleInfrastructure } from '@/shared/infrastructure/di/register-modules';
import { setGetTeamId } from '@/shared/infrastructure/api';
import { useTeamStore } from '@/modules/team/presentation/stores';
import 'invokers-polyfill';
import '@/assets/stylesheets/theme.css';
import '@/assets/stylesheets/base.css';
import '@/assets/stylesheets/general.css';
import '@/assets/stylesheets/animations.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false
        }
    }
});

registerModuleInfrastructure();
setGetTeamId(() => useTeamStore.getState().selectedTeam?._id || null);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>,
);
