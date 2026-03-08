import { SOCKET_TEAM_AI_INTEGRATION_EVENTS } from '@/modules/socket/team/constants/team-socket-events';
import useSocketEvent from '@/modules/socket/core/hooks/use-socket-event';
import { AI_INTEGRATION_QUERY_KEYS } from './queries';
import { useCallback } from 'react';
import queryClient from '@/shared/infrastructure/query/query-client';

interface TeamScopedPayload {
    teamId?: string;
    _teamId?: string;
}

export default function useTeamAIIntegrationsSocketSync(teamId: string | null | undefined): void {
    const handleSync = useCallback((payload: TeamScopedPayload | undefined) => {
        if (!teamId) {
            return;
        }

        const payloadTeamId = payload?._teamId ?? payload?.teamId;

        if (payloadTeamId !== teamId) {
            return;
        }

        Promise.all([
            queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations(teamId) }),
            queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels(teamId) })
        ]);
    }, [teamId]);

    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.CREATED, handleSync, { enabled: !!teamId });
    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.UPDATED, handleSync, { enabled: !!teamId });
    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.DELETED, handleSync, { enabled: !!teamId });
}
