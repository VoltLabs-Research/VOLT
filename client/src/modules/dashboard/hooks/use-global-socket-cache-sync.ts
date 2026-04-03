import { containerQuery } from '@/modules/container/hooks/queries';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { TEAM_QUERY_KEYS } from '@/modules/team/hooks/team/queries';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useEffect, useRef } from 'react';
import type { QueryKey } from '@tanstack/react-query';

interface SocketCacheSyncEvent {
    event: string;
    queryKeys: QueryKey[];
};

const GLOBAL_SOCKET_CACHE_SYNC_EVENTS: SocketCacheSyncEvent[] = [
    { event: 'team.created', queryKeys: [TEAM_QUERY_KEYS.teams()] },
    { event: 'team.deleted', queryKeys: [TEAM_QUERY_KEYS.teams()] },
    { event: 'container.created', queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: 'container.updated', queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: 'container.deleted', queryKeys: [containerQuery.QUERY_KEYS.lists()] }
];

const useGlobalSocketCacheSync = (): void => {
    const socketService = useSocket();
    const pendingQueryKeysRef = useRef(new Map<string, QueryKey>());
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const scheduleInvalidation = (queryKey: QueryKey) => {
            pendingQueryKeysRef.current.set(JSON.stringify(queryKey), queryKey);

            if (flushTimerRef.current) {
                return;
            }

            flushTimerRef.current = setTimeout(() => {
                const queryKeys = Array.from(pendingQueryKeysRef.current.values());
                pendingQueryKeysRef.current.clear();
                flushTimerRef.current = null;
                Promise.allSettled(queryKeys.map((currentQueryKey) => queryClient.invalidateQueries({ queryKey: currentQueryKey })));
            }, 150);
        };

        const unsubscribers = GLOBAL_SOCKET_CACHE_SYNC_EVENTS.map(({ event, queryKeys }) => {
            return socketService.on(event, () => {
                queryKeys.forEach(scheduleInvalidation);
            });
        });

        return () => {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            pendingQueryKeysRef.current.clear();
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [socketService]);
};

export default useGlobalSocketCacheSync;
