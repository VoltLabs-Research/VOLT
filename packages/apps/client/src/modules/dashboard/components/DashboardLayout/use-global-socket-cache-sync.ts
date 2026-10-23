import useSocketQueryInvalidation from '@/modules/socket/hooks/use-socket-query-invalidation';
import type { SocketInvalidationRule } from '@/modules/socket/hooks/use-socket-query-invalidation';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import { SOCKET_PLUGIN_EVENTS } from '@/modules/socket/events/plugin';
import { TEAM_QUERY_KEYS } from '@/modules/team/hooks/team/queries';
import { PLUGIN_CATALOG_ALL_QUERY_KEY } from '@/modules/plugin/hooks/plugin/catalog-query';

const GLOBAL_SOCKET_CACHE_SYNC_RULES: SocketInvalidationRule[] = [
    {
        event: SOCKET_TEAM_EVENTS.CREATED,
        queryKeys: [TEAM_QUERY_KEYS.teams()]
    },
    {
        event: SOCKET_TEAM_EVENTS.DELETED,
        queryKeys: [TEAM_QUERY_KEYS.teams()]
    },
    // The sidebar and the canvas read the plugin catalog, which grows while the default plugins
    // install behind a local stack that is already serving the app.
    {
        event: SOCKET_PLUGIN_EVENTS.CREATED,
        queryKeys: [PLUGIN_CATALOG_ALL_QUERY_KEY]
    },
    {
        event: SOCKET_PLUGIN_EVENTS.DELETED,
        queryKeys: [PLUGIN_CATALOG_ALL_QUERY_KEY]
    }
];

const useGlobalSocketCacheSync = (): void => {
    useSocketQueryInvalidation(GLOBAL_SOCKET_CACHE_SYNC_RULES);
};

export default useGlobalSocketCacheSync;
