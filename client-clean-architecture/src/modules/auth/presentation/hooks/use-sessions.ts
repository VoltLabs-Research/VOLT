import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Session } from '../../domain/entities';
import { sessionRepository } from '../../infrastructure/repositories/SessionRepository';

export const sessionQueryKeys = {
    all: ['sessions'] as const,
};

export const useSessions = () => {
    const queryClient = useQueryClient();

    const {
        data: sessions = [],
        isLoading: loading,
        error,
        refetch
    } = useQuery({
        queryKey: sessionQueryKeys.all,
        queryFn: () => sessionRepository.getAll(),
    });

    const revokeSessionMutation = useMutation({
        mutationFn: (sessionId: string) => sessionRepository.revoke(sessionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKeys.all });
        }
    });

    const revokeAllOtherSessionsMutation = useMutation({
        mutationFn: () => sessionRepository.revokeOthers(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sessionQueryKeys.all });
        }
    });

    return {
        sessions,
        loading,
        error: error ? (error as any).response?.data?.message || 'Failed to fetch sessions' : null,
        refetch,
        revokeSession: revokeSessionMutation.mutateAsync,
        revokeAllOtherSessions: revokeAllOtherSessionsMutation.mutateAsync
    };
};

export default useSessions;