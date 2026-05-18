type DiscoverTeamEmailPromptState = 'dismissed' | 'subscribed';

const STORAGE_KEY_PREFIX = 'volt:early-access:discover-team-email-prompt';

const getStorageKey = (teamId: string): string => `${STORAGE_KEY_PREFIX}:${teamId}`;

const hasLocalStorage = (): boolean => {
    try {
        return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
        return false;
    }
};

export const getDiscoverTeamEmailPromptState = (teamId: string): DiscoverTeamEmailPromptState | null => {
    if (!hasLocalStorage()) {
        return null;
    }

    const value = (() => {
        try {
            return window.localStorage.getItem(getStorageKey(teamId));
        } catch {
            return null;
        }
    })();

    return value === 'dismissed' || value === 'subscribed'
        ? value
        : null;
};

export const setDiscoverTeamEmailPromptState = (
    teamId: string,
    state: DiscoverTeamEmailPromptState
): void => {
    if (!hasLocalStorage()) {
        return;
    }

    try {
        window.localStorage.setItem(getStorageKey(teamId), state);
    } catch {
        // Ignore storage failures so the prompt still works in restricted browsers.
    }
};
