import { SOCKET_TEAM_AI_INTEGRATION_EVENTS } from '@/modules/socket/events/team';
import useSocketQueryInvalidation from '@/modules/socket/hooks/use-socket-query-invalidation';
import type { SocketInvalidationRule } from '@/modules/socket/hooks/use-socket-query-invalidation';
import { AI_INTEGRATION_QUERY_KEYS } from './queries';
import { useMemo } from 'react';

export default function useTeamAIIntegrationsSocketSync(teamId: string | null | undefined): void {
    const rules = useMemo<SocketInvalidationRule[]>(() => {
        if (!teamId) return [];

        const matches = (payload: unknown): boolean => {
            return (payload as { teamId?: string }).teamId === teamId;
        };

        const queryKeys = [
            AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations(teamId),
            AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels(teamId)
        ];

        return [
            {
                event: SOCKET_TEAM_AI_INTEGRATION_EVENTS.CREATED,
                queryKeys,
                matches
            },
            {
                event: SOCKET_TEAM_AI_INTEGRATION_EVENTS.UPDATED,
                queryKeys,
                matches
            },
            {
                event: SOCKET_TEAM_AI_INTEGRATION_EVENTS.DELETED,
                queryKeys,
                matches
            }
        ];
    }, [teamId]);

    useSocketQueryInvalidation(rules, { enabled: !!teamId });
}
