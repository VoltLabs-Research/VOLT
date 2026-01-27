/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useEffect, useRef } from 'react';
import { useTeamStore } from '@/modules/team/presentation/stores';
import { useAuthStore } from '@/modules/auth/presentation/stores';
import useTeamJobs from '@/modules/jobs/presentation/hooks/useTeamJobs';
import useTrajectoryUpdates from '@/modules/trajectory/presentation/hooks/useTrajectoryUpdates';
import useLogger from '@/shared/presentation/hooks/core/use-logger';
import { useSearchParams } from 'react-router';
import { useNotificationStore } from '@/modules/notification/presentation/stores';

const useAppInitializer = () => {
    const logger = useLogger('use-app-initializer');

    const user = useAuthStore((state) => state.user);
    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const { initializeNotificationSocket: initNotificationSocket } = useNotificationStore();
    const { fetchNotifications } = useNotificationStore();

    const teams = useTeamStore((state) => state.teams);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const [searchParams, setSearchParams] = useSearchParams();

    // Set the selected team
    useEffect(() => {
        if (!teams.length) return;

        const urlTeamId = searchParams.get('team');
        const storedTeamId = localStorage.getItem('selectedTeamId');

        // URL Team Id > Stored Team Id
        if (urlTeamId && urlTeamId !== storedTeamId) {
            const team = teams.find((team) => team._id === urlTeamId);
            if (team) {
                localStorage.setItem('selectedTeamId', urlTeamId);
                setSelectedTeam(urlTeamId);
            } else if (!urlTeamId && storedTeamId) {
                const team = teams.find((team) => team._id === storedTeamId);
                if (team) {
                    setSearchParams({ team: storedTeamId });
                }
            } else if (!urlTeamId && !storedTeamId && teams.length > 0) {
                const firstTeam = teams[0];
                setSearchParams({ team: firstTeam._id });
                localStorage.setItem('selectedTeamId', firstTeam._id);
            }
        }
    }, [teams, searchParams, setSearchParams, setSelectedTeam]);

    // Track the last initialized user ID to detect auth changes
    const lastInitializedUserRef = useRef<string | null>(null);
    // Track socket cleanup function to prevent duplicate subscriptions
    const notificationSocketCleanupRef = useRef<(() => void) | null>(null);

    // Subscribe to team jobs for real-time updates
    useTeamJobs();

    // Subscribe to trajectory updates (must be at app level to persist across navigation)
    useTrajectoryUpdates();

    // Initialize when user changes (login/logout)
    useEffect(() => {
        const currentUserId = user?._id ?? null;
        console.log('------------------------', currentUserId, user)
        if (lastInitializedUserRef.current === currentUserId) return;

        // Cleanup previous socket subscription if exists
        if (notificationSocketCleanupRef.current) {
            notificationSocketCleanupRef.current();
            notificationSocketCleanupRef.current = null;
        }

        if (!user) {
            lastInitializedUserRef.current = null;
            return;
        }

        lastInitializedUserRef.current = currentUserId;

        logger.log('Initializing global app data for user:', currentUserId);

        getUserTeams();
        // Store cleanup function in ref to prevent duplicate subscriptions
        notificationSocketCleanupRef.current = initNotificationSocket();
        fetchNotifications();

        return () => {
            if (notificationSocketCleanupRef.current) {
                notificationSocketCleanupRef.current();
                notificationSocketCleanupRef.current = null;
            }
        };
    }, [user?._id, getUserTeams, initNotificationSocket, fetchNotifications, logger]);
};

export default useAppInitializer;
