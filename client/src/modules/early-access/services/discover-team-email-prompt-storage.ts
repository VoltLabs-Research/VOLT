type DiscoverTeamEmailPromptState = 'dismissed' | 'subscribed';

const STORAGE_KEY_PREFIX = 'volt:early-access:discover-team-email-prompt';

const getStorageKey = (teamId: string): string => `${STORAGE_KEY_PREFIX}:${teamId}`;

export const getDiscoverTeamEmailPromptState = (teamId: string): DiscoverTeamEmailPromptState | null => {
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
    try {
        window.localStorage.setItem(getStorageKey(teamId), state);
    } catch {
    }
};
