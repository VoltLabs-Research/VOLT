import { useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useCallback, useEffect, useRef } from 'react';

interface UseTeamDataOptions {
    enabled?: boolean;
};

export default function useTeamData(options?: UseTeamDataOptions) {
    const enabled = options?.enabled ?? true;
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
    const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
    const hasHydratedSelection = useTeamStore((state) => state.hasHydratedSelection);
    const hydrateSelectedTeamId = useTeamStore((state) => state.hydrateSelectedTeamId);

    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const teamsQuery = useTeamsQuery(undefined, { enabled });

    const teams = teamsQuery.data ?? [];
    const isTeamsLoading = teamsQuery.isLoading;

    const teamsQueryRef = useRef(teamsQuery);
    teamsQueryRef.current = teamsQuery;

    const checkRBACErrorRef = useRef(checkRBACError);
    checkRBACErrorRef.current = checkRBACError;

    useEffect(() => {
        if (!enabled) {
            return;
        }

        hydrateSelectedTeamId();
    }, [enabled, hydrateSelectedTeamId]);

    useEffect(() => {
        if (teamsQuery.error) {
            checkRBACError(teamsQuery.error);
        }
    }, [teamsQuery.error, checkRBACError]);

    useEffect(() => {
        if (!hasHydratedSelection || !teamsQuery.data) return;

        if (teamsQuery.data.length === 0) {
            setSelectedTeamId(null);
            return;
        }

        const fetchedTeams = teamsQuery.data;
        const selectedTeam = fetchedTeams.find((team) => team._id === selectedTeamId);
        const teamToSelect = selectedTeam ?? fetchedTeams[0] ?? null;

        if (teamToSelect && teamToSelect._id !== selectedTeamId) {
            setSelectedTeamId(teamToSelect._id);
        }
    }, [hasHydratedSelection, teamsQuery.data, selectedTeamId, setSelectedTeamId]);

    const fetchTeams = useCallback(async () => {
        if (!enabled) {
            return;
        }

        const result = await teamsQueryRef.current.refetch();
        if (result.error) {
            checkRBACErrorRef.current(result.error);
        }
    }, [enabled]);

    const hydrateTeamAccess = useCallback(async (_teamId: string) => {
        return;
    }, []);

    return {
        teams,
        isTeamsLoading,
        selectedTeamId,
        hasHydratedSelection,
        fetchTeams,
        hydrateTeamAccess,
        accessDenied,
        accessDeniedMessage
    };
}
