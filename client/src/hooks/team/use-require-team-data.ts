/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useEffect } from 'react';
import { useTeamStore } from '@/stores/slices/team';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import useLogger from '@/hooks/core/use-logger';

interface UseRequireTeamDataOptions {
    enabled?: boolean;
    teamId?: string;
}

// Track which teams have been loaded
const loadedTeams = new Set<string>();

/**
 * Hook to ensure team data is loaded
 * - Loads trajectories for the selected team
 * - Returns loading states
 */
const useRequireTeamData = (options: UseRequireTeamDataOptions = {}) => {
    const { enabled = true, teamId } = options;
    const logger = useLogger('use-require-team-data');
    
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const isLoadingTrajectories = useTrajectoryStore((state) => state.isLoadingTrajectories);
    const trajectories = useTrajectoryStore((state) => state.trajectories);

    useEffect(() => {
        if (!enabled) return;

        const currentTeamId = teamId || selectedTeam?._id;
        if (!currentTeamId) return;

        // Skip if already loaded for this team
        if (loadedTeams.has(currentTeamId)) return;
        loadedTeams.add(currentTeamId);

        logger.log(`Loading team data for: ${currentTeamId}`);
        getTrajectories(currentTeamId, { page: 1, limit: 20 });
    }, [enabled, teamId, selectedTeam?._id]);

    return {
        isLoading: isLoadingTrajectories,
        trajectories
    };
};

export default useRequireTeamData;
