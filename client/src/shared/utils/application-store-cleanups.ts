import {
    registerErrorRecoveryCleanup,
    registerManualAppCleanup,
    registerSharedAppCleanup
} from '@/shared/utils/app-cleanup-registry';

import useTeamJobsStore from '@/modules/jobs/store/use-team-jobs-store';
import { useChatPresenceStore } from '@/modules/chat/store/chat/use-chat-presence-store';
import { useClusterStore } from '@/modules/cluster/store/use-cluster-store';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { useScreenshotStore } from '@/modules/canvas/store/use-screenshot-store';
import queryClient from '@/shared/query/query-client';

type StoreResetter = () => void;

const socketManagedStoreResetters = [
    () => useTeamJobsStore.getState().reset(),
    () => useClusterStore.getState().reset()
] satisfies StoreResetter[];

const teamScopedStoreResetters = [
    () => useEditorStore.getState().resetAll(),
    () => useScreenshotStore.getState().reset(),
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
