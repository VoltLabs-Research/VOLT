/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useEffect } from 'react';
import { useTeamStore } from '@/stores/slices/team';
import { useNotificationStore } from '@/stores/slices/notification';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import { useContainerStore } from '@/stores/slices/container';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import useLogger from '@/hooks/core/use-logger';

// Track if app has been initialized
let isInitialized = false;

const useAppInitializer = () => {
    const logger = useLogger('use-app-initializer');

    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const { initializeSocket: initNotificationSocket } = useNotificationStore();
    const { fetch: fetchNotifications } = useNotificationStore();
    const fetchPlugins = usePluginStore((state) => state.fetchPlugins);
    const fetchContainers = useContainerStore((state) => state.fetchContainers);

    // Subscribe to team jobs for real-time updates
    useTeamJobs();

    // Single initialization effect
    useEffect(() => {
        if (isInitialized) return;
        isInitialized = true;
        
        logger.log('Initializing global app data');

        // All these functions have internal cache guards
        getUserTeams();
        initNotificationSocket();
        fetchNotifications();
        fetchPlugins({ page: 1, limit: 100 });
        fetchContainers({ page: 1, limit: 20 });
    }, []);
};

export default useAppInitializer;
