import service from '../api/service';
import { buildKeys, createQuery, withSuccess } from '@/shared/infrastructure/query/create-paginated-query';
import { useMutation } from '@tanstack/react-query';
import type { MutationOptions } from '@/shared/infrastructure/query/create-paginated-query';
import type { RevokeAllOtherSessionsOutputDTO } from '../api/dtos/revoke-all-other-sessions';
import type { RevokeSessionInputDTO } from '../api/dtos/revoke-session';

type SessionQueryKeyMap = Record<string, unknown> & {
    activeSessions: void;
    loginActivity: number;
};

export const SESSION_QUERY_KEYS = buildKeys<SessionQueryKeyMap>('sessions');

export const activeSessionsQuery = createQuery(SESSION_QUERY_KEYS.activeSessions, () => service.getActiveSessions({}));
export const loginActivityQuery = createQuery(SESSION_QUERY_KEYS.loginActivity, (limit) => service.getLoginActivity({ limit }));

const invalidateActiveSessionsQuery = () => {
    return activeSessionsQuery.invalidate(undefined);
};

export const useRevokeSessionMutation = (options?: MutationOptions<void, RevokeSessionInputDTO>) => {
    return useMutation({
        ...options,
        mutationFn: service.revokeSession,
        onSuccess: withSuccess(() => {
            invalidateActiveSessionsQuery();
        }, options)
    });
};

export const useRevokeAllOtherSessionsMutation = (
    options?: MutationOptions<RevokeAllOtherSessionsOutputDTO, void>
) => {
    return useMutation<RevokeAllOtherSessionsOutputDTO, Error, void>({
        ...options,
        mutationFn: () => service.revokeAllOtherSessions({}),
        onSuccess: withSuccess(() => {
            invalidateActiveSessionsQuery();
        }, options)
    });
};
