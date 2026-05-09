import service from '../api/service';
import { buildKeys, createMutation, createQuery } from '@/shared/infrastructure/query';
import type { RevokeAllOtherSessionsOutputDTO, RevokeSessionInputDTO } from '../api/service';

type SessionQueryKeyMap = Record<string, unknown> & {
    activeSessions: void;
    loginActivity: number;
};

export const SESSION_QUERY_KEYS = buildKeys<SessionQueryKeyMap>('sessions');

export const activeSessionsQuery = createQuery(SESSION_QUERY_KEYS.activeSessions, () => service.getActiveSessions({}));
export const loginActivityQuery = createQuery(SESSION_QUERY_KEYS.loginActivity, (limit) => service.getLoginActivity({ limit }));

const invalidateActiveSessionsQuery = () => activeSessionsQuery.invalidate(undefined);

export const useRevokeSessionMutation = createMutation<void, RevokeSessionInputDTO>(
    service.revokeSession,
    () => invalidateActiveSessionsQuery()
);

export const useRevokeAllOtherSessionsMutation = createMutation<RevokeAllOtherSessionsOutputDTO, void>(
    () => service.revokeAllOtherSessions({}),
    () => invalidateActiveSessionsQuery()
);
