import GlobalContextMenu from '@/shared/ui/components/GlobalContextMenu';
import queryClient from '@/shared/query/query-client';
import { useScreenBridge } from '@/modules/marketing/hooks/use-screen-bridge';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes } from 'react-router-dom';
import type { LandingScreenScenario } from '@/modules/marketing/utils/landing-screens';
import type { ReactNode } from 'react';

interface LandingScreenRootProps {
    scenario: LandingScreenScenario;
    routes: ReactNode;
}

const ScreenBridge = ({ scenario }: { scenario: LandingScreenScenario }) => {
    useScreenBridge(scenario);
    return null;
};

// The app inside one of the landing's screens, as App renders it but with its history in
// memory: where its pages navigate stays in the screen, and the page walks it through
// `scenario` instead.
const LandingScreenRoot = ({ scenario, routes }: LandingScreenRootProps) => (
    <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[scenario.steps[0]]} useTransitions={false}>
            <ScreenBridge scenario={scenario} />
            <GlobalContextMenu>
                <Routes>{routes}</Routes>
            </GlobalContextMenu>
        </MemoryRouter>
    </QueryClientProvider>
);

export default LandingScreenRoot;
