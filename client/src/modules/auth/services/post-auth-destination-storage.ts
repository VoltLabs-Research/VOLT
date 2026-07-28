import { isDemoClusterFeatureEnabled } from '@/modules/cluster/utils/demo-feature';

const POST_AUTH_DESTINATION_STORAGE_KEY = 'volt:auth:post-auth-destination';
const DEFAULT_POST_AUTH_DESTINATION = '/dashboard';
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

const sanitizePostAuthDestination = (destination: string | null | undefined): string | null => {
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

    const pathname = safeDestination.split(/[?#]/)[0];
    return pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
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
    const safeDestination = sanitizePostAuthDestination(destination);

    if (!safeDestination) {
        window.sessionStorage.removeItem(POST_AUTH_DESTINATION_STORAGE_KEY);
        return;
    }

    window.sessionStorage.setItem(POST_AUTH_DESTINATION_STORAGE_KEY, safeDestination);
};

export const getPostAuthDestination = (): string | null => {
    const destination = sanitizePostAuthDestination(window.sessionStorage.getItem(POST_AUTH_DESTINATION_STORAGE_KEY));

    if (!destination) {
        window.sessionStorage.removeItem(POST_AUTH_DESTINATION_STORAGE_KEY);
    }

    return destination;
};

export const clearPostAuthDestination = (): void => {
    window.sessionStorage.removeItem(POST_AUTH_DESTINATION_STORAGE_KEY);
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
