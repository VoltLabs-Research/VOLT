import { containerQuery } from '@/modules/container/hooks/queries';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { TEAM_QUERY_KEYS } from '@/modules/team/hooks/team/queries';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useEffect } from 'react';
import type { QueryKey } from '@tanstack/react-query';

const GLOBAL_SOCKET_CACHE_SYNC_EVENTS: Array<{ event: string; queryKeys: QueryKey[] }> = [
    { event: 'team.created', queryKeys: [TEAM_QUERY_KEYS.teams()] },
    { event: 'team.deleted', queryKeys: [TEAM_QUERY_KEYS.teams()] },
    { event: 'container.created', queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: 'container.deleted', queryKeys: [containerQuery.QUERY_KEYS.lists()] }
];

const useGlobalSocketCacheSync = (): void => {
    const socketService = useSocket();

    useEffect(() => {
        const unsubscribers = GLOBAL_SOCKET_CACHE_SYNC_EVENTS.map(({ event, queryKeys }) => {
            return socketService.on(event, () => {
                void Promise.allSettled(
                    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
                );
            });
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [socketService]);
};

export default useGlobalSocketCacheSync;
