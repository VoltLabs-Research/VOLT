import './screen-isolation';

import '@/shared/ui/assets/stylesheets/fonts.css';

import '@/shared/ui/assets/stylesheets/index.css';
import LandingScreenRoot from '@/modules/marketing/components/LandingScreenRoot';
import { bootLandingScreen } from '@/modules/marketing/utils/screen-boot';
import { renderWorkspaceRoutes } from './routes/RouteRenderer';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// One of the landing's screens (landing-screen.html): the app's workspace, signed in to the
// lab its fixtures describe.
const scenario = bootLandingScreen(window.location.search);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LandingScreenRoot scenario={scenario} routes={renderWorkspaceRoutes()} />
    </StrictMode>
);
