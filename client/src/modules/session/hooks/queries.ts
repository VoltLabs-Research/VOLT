import service from '../api/service';
import { buildKeys, createMutation, createQuery } from '@/shared/query';
import type { RevokeAllOtherSessionsResponse, RevokeSessionInput } from '../api/service';

type SessionQueryKeyMap = Record<string, unknown> & {
    activeSessions: void;
    loginActivity: number;
};

const SESSION_QUERY_KEYS = buildKeys<SessionQueryKeyMap>('sessions');

export const activeSessionsQuery = createQuery(SESSION_QUERY_KEYS.activeSessions, () => service.getActiveSessions({}));
export const loginActivityQuery = createQuery(SESSION_QUERY_KEYS.loginActivity, (limit) => service.getLoginActivity({ limit }));

const invalidateActiveSessionsQuery = () => activeSessionsQuery.invalidate(undefined);

export const useRevokeSessionMutation = createMutation<void, RevokeSessionInput>(
    service.revokeSession,
    () => invalidateActiveSessionsQuery()
);

export const useRevokeAllOtherSessionsMutation = createMutation<RevokeAllOtherSessionsResponse, void>(
    () => service.revokeAllOtherSessions({}),
    () => invalidateActiveSessionsQuery()
);
