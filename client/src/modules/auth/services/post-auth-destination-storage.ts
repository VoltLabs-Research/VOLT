import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utilities/demo-feature';

const POST_AUTH_DESTINATION_STORAGE_KEY = 'volt:auth:post-auth-destination';
export const DEFAULT_POST_AUTH_DESTINATION = '/dashboard';
const ONBOARDING_PATH = '/onboarding';
const CLUSTER_ONBOARDING_PATH = '/onboarding/cluster/setup';
const CLUSTER_ONBOARDING_CHOICE_PATH = '/onboarding/cluster/choice';

interface ResolvePostAuthDestinationInput {
    queryNext?: string | null;
}

interface BuildOnboardingRedirectPathInput {
    destination?: string | null;
    onboardingPath: string;
}

const getSessionStorage = (): Storage => {
    return window.sessionStorage;
};

export const sanitizePostAuthDestination = (destination: string | null | undefined): string | null => {
    if (!destination) {
        return null;
    }

    if (!destination.startsWith('/') || destination.startsWith('//')) {
        return null;
    }

    try {
        const url = new URL(destination, window.location.origin);

        if (url.origin !== window.location.origin) {
            return null;
        }

        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return null;
    }
};

const isOnboardingDestination = (destination: string): boolean => {
    const safeDestination = sanitizePostAuthDestination(destination);
    if (!safeDestination) {
        return false;
    }

    try {
        const url = new URL(safeDestination, window.location.origin);
        return url.pathname === ONBOARDING_PATH || url.pathname.startsWith(`${ONBOARDING_PATH}/`);
    } catch {
        return false;
    }
};

const buildOnboardingRedirectPath = ({
    destination,
    onboardingPath
}: BuildOnboardingRedirectPathInput): string => {
    const safeDestination = sanitizePostAuthDestination(destination);

    if (!safeDestination || isOnboardingDestination(safeDestination)) {
        return onboardingPath;
    }

    return `${onboardingPath}?next=${encodeURIComponent(safeDestination)}`;
};

export const setPostAuthDestination = (destination: string): void => {
    const storage = getSessionStorage();
    if (!storage) {
        return;
    }

    const safeDestination = sanitizePostAuthDestination(destination);

    if (!safeDestination) {
        storage.removeItem(POST_AUTH_DESTINATION_STORAGE_KEY);
        return;
    }

    storage.setItem(POST_AUTH_DESTINATION_STORAGE_KEY, safeDestination);
};

export const getPostAuthDestination = (): string | null => {
    const storage = getSessionStorage();
    if (!storage) {
        return null;
    }

    const destination = sanitizePostAuthDestination(storage.getItem(POST_AUTH_DESTINATION_STORAGE_KEY));

    if (!destination) {
        storage.removeItem(POST_AUTH_DESTINATION_STORAGE_KEY);
    }

    return destination;
};

export const clearPostAuthDestination = (): void => {
    const storage = getSessionStorage();
    if (!storage) {
        return;
    }

    storage.removeItem(POST_AUTH_DESTINATION_STORAGE_KEY);
};

export const resolvePostAuthDestination = ({
    queryNext
}: ResolvePostAuthDestinationInput): string => {
    const safeQueryNext = sanitizePostAuthDestination(queryNext);
    if (safeQueryNext) {
        return safeQueryNext;
    }

    const storedDestination = getPostAuthDestination();
    if (storedDestination) {
        return storedDestination;
    }

    return DEFAULT_POST_AUTH_DESTINATION;
};

export const getOnboardingRedirectPath = (destination?: string | null): string => {
    return buildOnboardingRedirectPath({
        destination,
        onboardingPath: ONBOARDING_PATH
    });
};

export const getClusterOnboardingRedirectPath = (destination?: string | null): string => {
    return buildOnboardingRedirectPath({
        destination,
        onboardingPath: isDemoClusterFeatureEnabled()
            ? CLUSTER_ONBOARDING_CHOICE_PATH
            : CLUSTER_ONBOARDING_PATH
    });
};

export const getPostAuthRedirectPath = (destination: string): string => {
    const safeDestination = sanitizePostAuthDestination(destination) ?? DEFAULT_POST_AUTH_DESTINATION;

    if (isOnboardingDestination(safeDestination)) {
        return safeDestination;
    }

    return getOnboardingRedirectPath(safeDestination);
};
