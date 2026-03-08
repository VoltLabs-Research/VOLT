import { useCallback } from 'react';
import queryClient from '@/shared/infrastructure/query/query-client';
import { AI_INTEGRATION_QUERY_KEYS } from '@/modules/team/hooks/ai-integration/queries';
import { SOCKET_TEAM_AI_INTEGRATION_EVENTS } from '../api/entities/socket-constants';
import useSocketEvent from './use-socket-event';

interface TeamScopedPayload {
    teamId?: string;
    _teamId?: string;
}

const useTeamAIIntegrationsSocketSync = (teamId: string | null | undefined): void => {
    const handleSync = useCallback((payload: TeamScopedPayload | undefined) => {
        if (!teamId) {
            return;
        }

        const payloadTeamId = payload?._teamId ?? payload?.teamId;

        if (payloadTeamId !== teamId) {
            return;
        }

        void Promise.all([
            queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations(teamId) }),
            queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels(teamId) })
        ]);
    }, [teamId]);

    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.CREATED, handleSync, { enabled: !!teamId });
    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.UPDATED, handleSync, { enabled: !!teamId });
    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.DELETED, handleSync, { enabled: !!teamId });
};

export default useTeamAIIntegrationsSocketSync;
