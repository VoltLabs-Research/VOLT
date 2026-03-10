import service from '../api/service';
import { buildKeys, createCachePolicy, createManagedMutation, createQuery } from '@/shared/infrastructure/query';
import type { RevokeAllOtherSessionsOutputDTO } from '../api/dtos/revoke-all-other-sessions';
import type { RevokeSessionInputDTO } from '../api/dtos/revoke-session';

type SessionQueryKeyMap = Record<string, unknown> & {
    activeSessions: void;
    loginActivity: number;
};

export const SESSION_QUERY_KEYS = buildKeys<SessionQueryKeyMap>('sessions');

export const activeSessionsQuery = createQuery(SESSION_QUERY_KEYS.activeSessions, () => service.getActiveSessions({}));
export const loginActivityQuery = createQuery(SESSION_QUERY_KEYS.loginActivity, (limit) => service.getLoginActivity({ limit }));

const activeSessionsCache = createCachePolicy<void>(SESSION_QUERY_KEYS.activeSessions);

const invalidateActiveSessionsQuery = () => activeSessionsCache.invalidate(undefined);

export const useRevokeSessionMutation = createManagedMutation<void, RevokeSessionInputDTO>(
    service.revokeSession,
    () => invalidateActiveSessionsQuery()
);

export const useRevokeAllOtherSessionsMutation = createManagedMutation<RevokeAllOtherSessionsOutputDTO, void>(
    () => service.revokeAllOtherSessions({}),
    () => invalidateActiveSessionsQuery()
);
