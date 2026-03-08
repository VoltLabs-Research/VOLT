import useSocket from '@/modules/socket/core/hooks/use-socket';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useEffect } from 'react';
import type { QueryKey } from '@tanstack/react-query';

const GLOBAL_SOCKET_CACHE_SYNC_EVENTS: Array<{ event: string; queryKeys: QueryKey[] }> = [
    { event: 'team.created', queryKeys: [['teams']] },
    { event: 'team.deleted', queryKeys: [['teams']] }
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
