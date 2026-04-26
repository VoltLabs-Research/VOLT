import { containerQuery } from '@/modules/container/hooks/queries';
import useSocketQueryInvalidation from '@/modules/socket/hooks/use-socket-query-invalidation';
import type { SocketInvalidationRule } from '@/modules/socket/hooks/use-socket-query-invalidation';
import { SOCKET_CONTAINER_EVENTS } from '@/modules/socket/events/container';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import { TEAM_QUERY_KEYS } from '@/modules/team/hooks/team/queries';

const GLOBAL_SOCKET_CACHE_SYNC_RULES: SocketInvalidationRule[] = [
    { event: SOCKET_TEAM_EVENTS.CREATED, queryKeys: [TEAM_QUERY_KEYS.teams()] },
    { event: SOCKET_TEAM_EVENTS.DELETED, queryKeys: [TEAM_QUERY_KEYS.teams()] },
    { event: SOCKET_CONTAINER_EVENTS.CREATED, queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: SOCKET_CONTAINER_EVENTS.UPDATED, queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: SOCKET_CONTAINER_EVENTS.DELETED, queryKeys: [containerQuery.QUERY_KEYS.lists()] }
];

const useGlobalSocketCacheSync = (): void => {
    useSocketQueryInvalidation(GLOBAL_SOCKET_CACHE_SYNC_RULES);
};

export default useGlobalSocketCacheSync;
