import { TeamClusterStatus } from '@/modules/dashboard/api/entities/team-cluster';
import { useDashboardTeamClustersQuery } from '@/modules/dashboard/hooks/queries';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

interface DashboardClusterOnboardingState {
    hasAnyConnectedCluster: boolean;
    hasSelectedTeamConnectedCluster: boolean;
    isLoading: boolean;
    selectedTeamName: string | null;
    shouldShowOverlay: boolean;
};

const TEAM_CLUSTER_QUERY_LIMIT = 50;
const TEAM_CLUSTER_REFETCH_INTERVAL = 15000;

const hasConnectedCluster = (statuses: TeamClusterStatus[]): boolean => {
    return statuses.includes(TeamClusterStatus.Connected);
};

const useDashboardClusterOnboarding = (): DashboardClusterOnboardingState => {
    const selectedTeam = useSelectedTeam();
    const { teams, isTeamsLoading } = useTeamData();

    const teamClusterQueries = useQueries({
        queries: teams.map((team) => ({
            ...useDashboardTeamClustersQuery.buildOptions({
                teamId: team._id,
                limit: TEAM_CLUSTER_QUERY_LIMIT
            }),
            staleTime: TEAM_CLUSTER_REFETCH_INTERVAL,
            refetchInterval: TEAM_CLUSTER_REFETCH_INTERVAL
        }))
    });

    return useMemo(() => {
        const isLoading = isTeamsLoading || teamClusterQueries.some((query) => query.isLoading);

        if (!selectedTeam) {
            return {
                hasAnyConnectedCluster: false,
                hasSelectedTeamConnectedCluster: false,
                isLoading,
                selectedTeamName: null,
                shouldShowOverlay: false
            };
        }

        const statusesByTeamId = new Map<string, TeamClusterStatus[]>();

        teamClusterQueries.forEach((query, index) => {
            const team = teams[index];
            if (!team) {
                return;
            }

            const statuses = (query.data ?? []).map((cluster) => cluster.status);
            statusesByTeamId.set(team._id, statuses);
        });

        const hasAnyConnectedCluster = Array.from(statusesByTeamId.values()).some(hasConnectedCluster);
        const selectedTeamStatuses = statusesByTeamId.get(selectedTeam._id) ?? [];
        const hasSelectedTeamConnectedCluster = hasConnectedCluster(selectedTeamStatuses);

        return {
            hasAnyConnectedCluster,
            hasSelectedTeamConnectedCluster,
            isLoading,
            selectedTeamName: selectedTeam.name,
            shouldShowOverlay: !isLoading && !hasSelectedTeamConnectedCluster
        };
    }, [isTeamsLoading, selectedTeam, teamClusterQueries, teams]);
};

export default useDashboardClusterOnboarding;
