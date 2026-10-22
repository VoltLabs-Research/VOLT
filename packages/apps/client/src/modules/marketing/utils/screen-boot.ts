import socketService from '@/modules/socket/services/socket-service';
import teamStorage from '@/modules/team/services/team/team-storage';
import { LANDING_ROUTES } from '@/modules/marketing/utils/landing-routes';
import { LANDING_TEAM_ID } from '@/modules/marketing/utils/landing-workspace';
import { holdContextualTips } from '@/shared/tips/tip-storage';
import { resolveLandingScreen } from '@/modules/marketing/utils/landing-screens';
import { serveConversation } from '@/modules/marketing/utils/landing-assistant';
import { serveScreen } from '@/modules/marketing/utils/screen-server';
import { tokenStorage } from '@/shared/auth/token-storage';
import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { useTeamStore } from '@/modules/team/store/team/use-team-store';
import type { LandingScreenScenario } from '@/modules/marketing/utils/landing-screens';

// A screen signs in to the lab the way the app does, with its storage already isolated:
// the token and team it stores are the screen's own.
export const bootLandingScreen = (search: string): LandingScreenScenario => {
    socketService.hold();
    holdContextualTips();
    serveScreen(LANDING_ROUTES);
    serveConversation();

    tokenStorage.setToken('landing-screen');
    teamStorage.setSelectedTeamId(LANDING_TEAM_ID);
    useTeamStore.getState().hydrateSelectedTeamId();
    void useAuthStore.getState().initializeAuth();

    return resolveLandingScreen(new URLSearchParams(search).get('screen'));
};
