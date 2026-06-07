import { endpointStorage } from '@/app/core/http/utilities/endpoint-storage';
import { tokenStorage } from '@/shared/auth/token-storage';
import teamStorage from '@/modules/team/services/team/team-storage';

export const commitBackendEndpoint = (origin: string): void => {
    endpointStorage.setEndpoint(origin);
    window.location.assign('/auth/sign-in');
};

export const resetBackendEndpoint = (): void => {
    endpointStorage.clearEndpoint();
    tokenStorage.removeToken();
    teamStorage.clearSelectedTeamId();
    window.location.assign('/connect');
};
