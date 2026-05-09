import {
    registerErrorRecoveryCleanup,
    registerManualAppCleanup,
    registerSharedAppCleanup
} from '@/shared/utils/app-cleanup-registry';

import queryClient from '@/shared/infrastructure/query/query-client';

/**
 * Stores whose lifecycle is managed by WebSocket hooks (cluster metrics,
 * team jobs).  Their `isConnected` flag must stay in sync with the real
 * socket state, so they must NOT be bulk-reset during a team switch -
 * the owning hook already handles re-subscription when the team changes.
 *
 * They ARE still reset during full session cleanup (route navigation,
 * logout) via {@link resetAllApplicationStores}.
 */
const socketManagedStoreResetters = [
    () => {
        void import('@/modules/jobs/stores/use-team-jobs-store')
            .then(({ default: useTeamJobsStore }) => {
                useTeamJobsStore.getState().reset();
            })
            .catch(() => undefined);
    },
    () => {
        void import('@/modules/cluster/stores/use-cluster-store')
            .then(({ useClusterStore }) => {
                useClusterStore.getState().reset();
            })
            .catch(() => undefined);
    }
];

/**
 * Stores that hold team-scoped UI state and can safely be reset on
 * every team switch without side-effects.
 */
const teamScopedStoreResetters = [
    () => {
        void import('@/modules/canvas/stores/editor')
            .then(({ useEditorStore }) => {
                useEditorStore.getState().resetAll();
            })
            .catch(() => undefined);
    },
    () => {
        void import('@/modules/canvas/stores/use-screenshot-store')
            .then(({ useScreenshotStore }) => {
                useScreenshotStore.getState().reset();
            })
            .catch(() => undefined);
    },
    () => {
        void import('@/modules/canvas/stores/use-keyboard-shortcuts-store')
            .then(({ useKeyboardShortcutsStore }) => {
                useKeyboardShortcutsStore.getState().reset();
            })
            .catch(() => undefined);
    },
    () => {
        void import('@/modules/chat/stores/chat/use-chat-presence-store')
            .then(({ useChatPresenceStore }) => {
                useChatPresenceStore.getState().reset();
            })
            .catch(() => undefined);
    },
    () => {
        void import('@/modules/plugin/stores/plugin/use-plugin-builder-store')
            .then(({ usePluginBuilderStore }) => {
                usePluginBuilderStore.getState().reset();
            })
            .catch(() => undefined);
    },
    () => {
        void import('@/modules/plugin/stores/plugin/use-plugin-debug-store')
            .then(({ usePluginDebugStore }) => {
                usePluginDebugStore.getState().reset();
            })
            .catch(() => undefined);
    },
    () => {
        void import('@/modules/team/stores/team/use-team-presence-store')
            .then(({ useTeamPresenceStore }) => {
                useTeamPresenceStore.getState().reset();
            })
            .catch(() => undefined);
    }
];

/** Every store resetter - used for full cleanup (route nav, logout). */
const allStoreResetters = [...teamScopedStoreResetters, ...socketManagedStoreResetters];

const safeResetAll = (resetters: Array<() => void>): void => {
    for (const reset of resetters) {
        try {
            reset();
        } catch {
            // Ignore individual store reset failures
        }
    }
};

/**
 * Resets only team-scoped stores, leaving socket-managed stores
 * (cluster, jobs) intact so their WebSocket hooks can reconcile
 * state naturally when the selected team changes.
 *
 * Used by {@link resetTeamScopedApplicationState} during team switch.
 */
export const resetTeamScopedStores = (): void => {
    safeResetAll(teamScopedStoreResetters);
};

/**
 * Resets all application Zustand stores to their initial state,
 * including socket-managed stores.
 *
 * Used for full session cleanup (route navigation, logout).
 */
export const resetAllApplicationStores = (): void => {
    safeResetAll(allStoreResetters);
};

let areApplicationStoreCleanupsRegistered = false;

const registerStoreCleanup = (resetStore: () => void): void => {
    registerSharedAppCleanup(() => {
        resetStore();
    });
};

export const ensureApplicationStoreCleanupsRegistered = (): void => {
    if (areApplicationStoreCleanupsRegistered) {
        return;
    }

    areApplicationStoreCleanupsRegistered = true;

    allStoreResetters.forEach(registerStoreCleanup);

    registerErrorRecoveryCleanup(() => {
        queryClient.clear();
    });

    registerManualAppCleanup(() => {
        queryClient.clear();
    });
};
