import {
    registerErrorRecoveryCleanup,
    registerManualAppCleanup,
    registerSharedAppCleanup
} from '@/shared/utils/app-cleanup-registry';

import useTeamJobsStore from '@/modules/jobs/stores/use-team-jobs-store';
import { useChatPresenceStore } from '@/modules/chat/stores/chat/use-chat-presence-store';
import { useClusterStore } from '@/modules/cluster/stores/use-cluster-store';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useKeyboardShortcutsStore } from '@/modules/canvas/stores/use-keyboard-shortcuts-store';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import queryClient from '@/shared/infrastructure/query/query-client';

type StoreResetter = () => void;

const socketManagedStoreResetters = [
    () => useTeamJobsStore.getState().reset(),
    () => useClusterStore.getState().reset()
] satisfies StoreResetter[];

const teamScopedStoreResetters = [
    () => useEditorStore.getState().resetAll(),
    () => useScreenshotStore.getState().reset(),
    () => useKeyboardShortcutsStore.getState().reset(),
    () => useChatPresenceStore.getState().reset(),
    () => usePluginBuilderStore.getState().reset(),
    () => usePluginDebugStore.getState().reset()
] satisfies StoreResetter[];

const allStoreResetters = [...teamScopedStoreResetters, ...socketManagedStoreResetters];

const resetStores = (resetters: StoreResetter[]): void => {
    resetters.forEach((reset) => reset());
};

export const resetTeamScopedStores = (): void => {
    resetStores(teamScopedStoreResetters);
};

let areApplicationStoreCleanupsRegistered = false;

const registerStoreCleanup = (resetStore: () => void): void => {
    registerSharedAppCleanup(resetStore);
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
