/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useEffect, useRef } from 'react';
import { useTeamStore } from '@/stores/slices/team';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import useLogger from '@/hooks/core/use-logger';

interface UseRequireTeamDataOptions {
    enabled?: boolean;
    teamId?: string;
}

/**
 * Hook to ensure team data is loaded
 * - Loads trajectories for the selected team
 * - Handles initialization and deduplication of requests
 * - Returns loading states
 */
const useRequireTeamData = (options: UseRequireTeamDataOptions = {}) => {
    const { enabled = true, teamId } = options;
    const logger = useLogger('use-require-team-data');
    
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const isLoadingTrajectories = useTrajectoryStore((state) => state.isLoadingTrajectories);
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    
    const activeTeamIdRef = useRef<string | null>(null);
    const requestInFlightRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;

        const currentTeamId = teamId || selectedTeam?._id;
        
        if (!currentTeamId) {
            logger.log('No team ID available');
            return;
        }

        // If already loading data for this team, skip
        if (activeTeamIdRef.current === currentTeamId && requestInFlightRef.current) {
            logger.log(`Team data already loading for ${currentTeamId}`);
            return;
        }

        // If already loaded for this team, skip
        if (activeTeamIdRef.current === currentTeamId && trajectories.length > 0) {
            logger.log(`Team data already loaded for ${currentTeamId}`);
            return;
        }

        // Team changed, need to reload
        if (activeTeamIdRef.current !== currentTeamId) {
            logger.log(`Loading team data for new team: ${currentTeamId}`);
            activeTeamIdRef.current = currentTeamId;
            requestInFlightRef.current = true;

            getTrajectories(currentTeamId, { page: 1, limit: 20 })
                .finally(() => {
                    requestInFlightRef.current = false;
                });
        }
    }, [enabled, teamId, selectedTeam?._id, trajectories.length, getTrajectories, logger]);

    return {
        isLoading: isLoadingTrajectories,
        trajectories,
        teamId: activeTeamIdRef.current
    };
};

export default useRequireTeamData;
