import service from '../api/service';
import { buildKeys } from '@/shared/query/query-keys';
import { createMutation } from '@/shared/query/create-mutation';
import { createQuery } from '@/shared/query/create-query';
import type { RevokeAllSessionsResponse } from '@volt/contracts/modules/session/domain';
import type { RevokeSessionInput } from '../api/service';

type SessionQueryKeyMap = {
    activeSessions: void;
    loginActivity: void;
};

const SESSION_QUERY_KEYS = buildKeys<SessionQueryKeyMap>('sessions');

export const activeSessionsQuery = createQuery(SESSION_QUERY_KEYS.activeSessions, () => service.getActiveSessions({}));
export const loginActivityQuery = createQuery(SESSION_QUERY_KEYS.loginActivity, () => service.getLoginActivity({}));

const invalidateActiveSessionsQuery = () => activeSessionsQuery.invalidate(undefined);

export const useRevokeSessionMutation = createMutation<void, RevokeSessionInput>(
    service.revokeSession,
    () => invalidateActiveSessionsQuery()
);

export const useRevokeAllOtherSessionsMutation = createMutation<RevokeAllSessionsResponse, void>(
    () => service.revokeAllOtherSessions({}),
    () => invalidateActiveSessionsQuery()
);
