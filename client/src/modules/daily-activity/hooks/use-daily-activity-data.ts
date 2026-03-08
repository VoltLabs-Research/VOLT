import { useEffect } from 'react';
import { dailyActivityQuery } from './queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

const DEFAULT_RANGE = 365;

interface UseDailyActivityDataOptions {
    range?: number;
}

const useDailyActivityData = (options?: UseDailyActivityDataOptions) => {
    const range = options?.range ?? DEFAULT_RANGE;
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const activityQuery = dailyActivityQuery({ range });

    useEffect(() => {
        if(activityQuery.error){
            checkRBACError(activityQuery.error);
        }
    }, [activityQuery.error, checkRBACError]);

    const errorMessage = activityQuery.error instanceof Error ? activityQuery.error.message : null;

    return {
        activityData: activityQuery.data || [],
        isLoading: activityQuery.isLoading,
        error: errorMessage,
        accessDenied,
        accessDeniedMessage,
        fetchActivity: () => activityQuery.refetch()
    };
};

export default useDailyActivityData;
