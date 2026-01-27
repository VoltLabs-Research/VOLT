import { useQuery } from '@tanstack/react-query';
import { sessionRepository } from '../../infrastructure/repositories/SessionRepository';

export const loginActivityQueryKeys = {
    all: ['login-activity'] as const,
    list: (limit?: number) => ['login-activity', limit] as const
};

export const useLoginActivity = (limit?: number) => {
    const { 
        data: activities = [], 
        isLoading: loading, 
        error, 
        refetch 
    } = useQuery({
        queryKey: loginActivityQueryKeys.list(limit),
        queryFn: () => sessionRepository.getLoginActivity(limit ? { limit } : undefined)
    });

    return {
        activities,
        loading,
        error: error ? (error as any).message || 'Failed to fetch login activity' : null,
        refetch
    };
};

export default useLoginActivity;