import { dailyActivityQuery } from './queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect } from 'react';

interface UseDailyActivityDataOptions {
    range?: number;
};

const DEFAULT_RANGE = 365;

const useDailyActivityData = (options?: UseDailyActivityDataOptions) => {
    const range = options?.range ?? DEFAULT_RANGE;
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const activityQuery = dailyActivityQuery({ range });

    useEffect(() => {
        if(activityQuery.error){
            checkAccessDeniedError(activityQuery.error);
        }
    }, [activityQuery.error, checkAccessDeniedError]);

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
