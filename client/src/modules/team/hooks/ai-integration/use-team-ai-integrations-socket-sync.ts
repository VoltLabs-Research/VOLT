import { SOCKET_TEAM_AI_INTEGRATION_EVENTS } from '@/modules/socket/team/constants/team-socket-events';
import useSocketEvent from '@/modules/socket/core/hooks/use-socket-event';
import { invalidateTeamAIIntegrationsQuery } from './queries';
import { useCallback } from 'react';

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

        invalidateTeamAIIntegrationsQuery(teamId).catch(() => undefined);
    }, [teamId]);

    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.CREATED, handleSync, { enabled: !!teamId });
    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.UPDATED, handleSync, { enabled: !!teamId });
    useSocketEvent<TeamScopedPayload>(SOCKET_TEAM_AI_INTEGRATION_EVENTS.DELETED, handleSync, { enabled: !!teamId });
}
