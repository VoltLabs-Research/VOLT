import { dailyActivityQuery } from './queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect } from 'react';

interface UseDailyActivityDataOptions {
    range?: number;
    enabled?: boolean;
    refetchIntervalMs?: number;
    scope?: 'team' | 'self';
};

const DEFAULT_RANGE = 365;

const useDailyActivityData = (options?: UseDailyActivityDataOptions) => {
    const range = options?.range ?? DEFAULT_RANGE;
    const scope = options?.scope ?? 'team';
    const teamId = useSelectedTeamId();
    const isEnabled = (options?.enabled ?? true) && Boolean(teamId);
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const activityQuery = dailyActivityQuery({
        teamId: teamId ?? '',
        range,
        scope
    }, {
        enabled: isEnabled,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchInterval: isEnabled ? options?.refetchIntervalMs ?? false : false,
        refetchIntervalInBackground: false
    });

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
