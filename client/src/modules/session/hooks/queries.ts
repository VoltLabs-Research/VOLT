import { useMutation } from '@tanstack/react-query';
import { buildKeys, createQuery, withSuccess, type MutationOptions } from '@/shared/infrastructure/query/create-paginated-query';
import type { RevokeAllOtherSessionsOutputDTO } from '../api/dtos/revoke-all-other-sessions';
import service from '../api/service';

export const SESSION_QUERY_KEYS = buildKeys<{
    activeSessions: void;
    loginActivity: number;
}>('sessions');

export const activeSessionsQuery = createQuery(SESSION_QUERY_KEYS.activeSessions, () => service.getActiveSessions({}));
export const loginActivityQuery = createQuery(SESSION_QUERY_KEYS.loginActivity, (limit) => service.getLoginActivity({ limit }));

const invalidateActiveSessionsQuery = () => {
    return activeSessionsQuery.invalidate(undefined);
};

export const useRevokeSessionMutation = (options?: MutationOptions<void, { sessionId: string }>) => {
    return useMutation({
        ...options,
        mutationFn: service.revokeSession,
        onSuccess: withSuccess(() => {
            void invalidateActiveSessionsQuery();
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
            void invalidateActiveSessionsQuery();
        }, options)
    });
};
