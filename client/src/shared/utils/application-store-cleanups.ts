import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { useKeyboardShortcutsStore } from '@/modules/canvas/presentation/stores/use-keyboard-shortcuts-store';
import { useScreenshotStore } from '@/modules/canvas/presentation/stores/use-screenshot-store';
import { useChatMessageStore } from '@/modules/chat/presentation/stores/use-chat-message-store';
import { useChatPresenceStore } from '@/modules/chat/presentation/stores/use-chat-presence-store';
import { useChatStore } from '@/modules/chat/presentation/stores/use-chat-store';
import { useClusterStore } from '@/modules/cluster/presentation/stores/use-cluster-store';
import useTeamJobsStore from '@/modules/jobs/presentation/stores/use-team-jobs-store';
import { useNotificationStore } from '@/modules/notification/presentation/stores/use-notification-store';
import useAnalysisStore from '@/modules/analysis/presentation/stores/use-analysis-store';
import usePluginBuilderStore from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/presentation/stores/use-plugin-debug-store';
import usePluginListingStore from '@/modules/plugin/presentation/stores/use-plugin-listing-store';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import { useTeamInvitationStore } from '@/modules/team/presentation/stores/use-team-invitation-store';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import { useTeamPresenceStore } from '@/modules/team/presentation/stores/use-team-presence-store';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import { registerSharedAppCleanup } from '@/shared/utils/app-cleanup-registry';

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

    [
        () => useEditorStore.getState().resetAll(),
        () => useScreenshotStore.getState().reset(),
        () => useKeyboardShortcutsStore.getState().reset(),
        () => useChatStore.getState().reset(),
        () => useChatMessageStore.getState().reset(),
        () => useChatPresenceStore.getState().reset(),
        () => useNotificationStore.getState().reset(),
        () => useTrajectoryStore.getState().reset(),
        () => useAnalysisStore.getState().reset(),
        () => useTeamJobsStore.getState().reset(),
        () => useClusterStore.getState().reset(),
        () => usePluginStore.getState().resetPlugins(),
        () => usePluginListingStore.getState().reset(),
        () => usePluginBuilderStore.getState().reset(),
        () => usePluginDebugStore.getState().reset(),
        () => useTeamInvitationStore.getState().reset(),
        () => useTeamRoleStore.getState().reset(),
        () => useTeamMemberStore.getState().reset(),
        () => useTeamPresenceStore.getState().reset()
    ].forEach(registerStoreCleanup);
};
