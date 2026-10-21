import { endpointStorage } from '@/app/core/http/utils/endpoint-storage';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import { tokenStorage } from '@/shared/auth/token-storage';
import teamStorage from '@/modules/team/services/team/team-storage';

export const commitBackendEndpoint = (origin: string): void => {
    endpointStorage.setEndpoint(origin);
    window.location.assign('/auth/sign-in');
};

export const runLocalStack = (): void => {
    endpointStorage.clearEndpoint();
    localStackMode.enable();
    window.location.assign('/dashboard');
};

export const resetBackendEndpoint = async (): Promise<void> => {
    await localStackMode.disable();
    endpointStorage.clearEndpoint();
    tokenStorage.removeToken();
    teamStorage.clearSelectedTeamId();
    window.location.assign('/connect');
};
