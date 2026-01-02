/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useEffect, useRef } from 'react';
import { useTeamStore } from '@/stores/slices/team';
import { useNotificationStore } from '@/stores/slices/notification';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import { useContainerStore } from '@/stores/slices/container';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import useLogger from '@/hooks/core/use-logger';

const useAppInitializer = () => {
    const logger = useLogger('use-app-initializer');
    const initializerRef = useRef(false);

    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const { initializeSocket: initNotificationSocket } = useNotificationStore();
    const { fetch: fetchNotifications } = useNotificationStore();
    const fetchPlugins = usePluginStore((state) => state.fetchPlugins);
    const fetchContainers = useContainerStore((state) => state.fetchContainers);

    // Subscribe to team jobs for real-time updates
    useTeamJobs();

    // Single initialization effect - runs only once
    useEffect(() => {
        // Guard against double initialization (React StrictMode, etc)
        if (initializerRef.current) return;
        initializerRef.current = true;

        logger.log('Initializing global app data');

        // Load user's teams (required for everything else)
        getUserTeams();

        // Initialize notification socket and fetch initial notifications
        // These are critical for real-time updates
        initNotificationSocket();
        fetchNotifications();

        // Preload plugins list in background
        fetchPlugins({ page: 1, limit: 100 });

        // Preload containers list in background
        fetchContainers({ page: 1, limit: 20 });
    }, [getUserTeams, initNotificationSocket, fetchNotifications, fetchPlugins, fetchContainers, logger]);
};

export default useAppInitializer;
