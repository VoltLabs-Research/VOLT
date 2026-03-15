const POST_AUTH_DESTINATION_STORAGE_KEY = 'volt:auth:post-auth-destination';
const TEAM_INVITATION_PATH_PREFIX = '/team-invitation/';

interface ResolvePostAuthDestinationInput {
    queryNext?: string | null;
    stateDestination?: string | null;
};

const getSessionStorage = (): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.sessionStorage;
};

export const isTeamInvitationDestination = (destination: string | null | undefined): destination is string => {
    return typeof destination === 'string' && destination.startsWith(TEAM_INVITATION_PATH_PREFIX);
};

export const setPostAuthDestination = (destination: string): void => {
    const storage = getSessionStorage();
    if (!storage) {
        return;
    }

    storage.setItem(POST_AUTH_DESTINATION_STORAGE_KEY, destination);
};

export const getPostAuthDestination = (): string | null => {
    const storage = getSessionStorage();
    if (!storage) {
        return null;
    }

    return storage.getItem(POST_AUTH_DESTINATION_STORAGE_KEY);
};

export const clearPostAuthDestination = (): void => {
    const storage = getSessionStorage();
    if (!storage) {
        return;
    }

    storage.removeItem(POST_AUTH_DESTINATION_STORAGE_KEY);
};

export const resolvePostAuthDestination = ({
    queryNext,
    stateDestination
}: ResolvePostAuthDestinationInput): string => {
    if (queryNext) {
        return queryNext;
    }

    if (stateDestination) {
        return stateDestination;
    }

    const storedDestination = getPostAuthDestination();
    if (storedDestination) {
        return storedDestination;
    }

    return '/dashboard';
};

export const getPostAuthRedirectPath = (destination: string): string => {
    if (isTeamInvitationDestination(destination)) {
        return destination;
    }

    if (destination === '/dashboard') {
        return '/onboarding';
    }

    return `/onboarding?next=${encodeURIComponent(destination)}`;
};
