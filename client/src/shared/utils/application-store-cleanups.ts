import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useKeyboardShortcutsStore } from '@/modules/canvas/stores/use-keyboard-shortcuts-store';
import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import { useChatPresenceStore } from '@/modules/chat/stores/chat/use-chat-presence-store';
import { useClusterStore } from '@/modules/cluster/stores/use-cluster-store';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import {
    registerErrorRecoveryCleanup,
    registerManualAppCleanup,
    registerSharedAppCleanup
} from '@/shared/utils/app-cleanup-registry';
import useTeamJobsStore from '@/modules/jobs/stores/use-team-jobs-store';
import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import useTrajectoryStore from '@/modules/trajectory/stores/trajectory/use-trajectory-store';
import queryClient from '@/shared/infrastructure/query/query-client';

/**
 * Stores whose lifecycle is managed by WebSocket hooks (cluster metrics,
 * team jobs).  Their `isConnected` flag must stay in sync with the real
 * socket state, so they must NOT be bulk-reset during a team switch —
 * the owning hook already handles re-subscription when the team changes.
 *
 * They ARE still reset during full session cleanup (route navigation,
 * logout) via {@link resetAllApplicationStores}.
 */
const socketManagedStoreResetters = [
    () => useTeamJobsStore.getState().reset(),
    () => useClusterStore.getState().reset()
];

/**
 * Stores that hold team-scoped UI state and can safely be reset on
 * every team switch without side-effects.
 */
const teamScopedStoreResetters = [
    () => useEditorStore.getState().resetAll(),
    () => useScreenshotStore.getState().reset(),
    () => useKeyboardShortcutsStore.getState().reset(),
    () => useChatPresenceStore.getState().reset(),
    () => useTrajectoryStore.getState().reset(),
    () => usePluginBuilderStore.getState().reset(),
    () => usePluginDebugStore.getState().reset(),
    () => useTeamPresenceStore.getState().reset()
];

/** Every store resetter — used for full cleanup (route nav, logout). */
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
