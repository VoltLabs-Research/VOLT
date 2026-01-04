/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useEffect, useRef } from 'react';
import { useTeamStore } from '@/stores/slices/team';
import { useNotificationStore } from '@/stores/slices/notification';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import { useContainerStore } from '@/stores/slices/container';
import { useAuthStore } from '@/stores/slices/auth';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import useTrajectoryUpdates from '@/hooks/trajectory/use-trajectory-updates';
import useLogger from '@/hooks/core/use-logger';

const useAppInitializer = () => {
    const logger = useLogger('use-app-initializer');

    const user = useAuthStore((state) => state.user);
    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const { initializeSocket: initNotificationSocket } = useNotificationStore();
    const { fetch: fetchNotifications } = useNotificationStore();
    // const fetchPlugins = usePluginStore((state) => state.fetchPlugins);
    // const fetchContainers = useContainerStore((state) => state.fetchContainers);

    // Track the last initialized user ID to detect auth changes
    const lastInitializedUserRef = useRef<string | null>(null);

    // Subscribe to team jobs for real-time updates
    useTeamJobs();

    // Subscribe to trajectory updates (must be at app level to persist across navigation)
    useTrajectoryUpdates();

    // Initialize when user changes (login/logout)
    useEffect(() => {
        const currentUserId = user?._id ?? null;

        // Skip if already initialized for this user (or null)
        if (lastInitializedUserRef.current === currentUserId) return;

        // Skip initialization if user is not authenticated
        if (!user) {
            lastInitializedUserRef.current = null;
            return;
        }

        lastInitializedUserRef.current = currentUserId;

        logger.log('Initializing global app data for user:', currentUserId);

        // All these functions have internal cache guards
        getUserTeams();
        initNotificationSocket();
        fetchNotifications();
        // fetchPlugins({ page: 1, limit: 100 });
        // fetchContainers({ page: 1, limit: 20 });
    }, [user?._id, getUserTeams, initNotificationSocket, fetchNotifications, logger]);
};

export default useAppInitializer;

