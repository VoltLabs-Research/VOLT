import { dailyActivityQuery } from './queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { useEffect } from 'react';
import type { GetDailyActivityParams } from '../api/service';

interface UseDailyActivityDataOptions extends GetDailyActivityParams {
    enabled?: boolean;
    refetchIntervalMs?: number;
};

const DEFAULT_RANGE = 365;

const useDailyActivityData = ({
    range = DEFAULT_RANGE,
    scope = 'team',
    enabled = true,
    refetchIntervalMs
}: UseDailyActivityDataOptions = {}) => {
    const teamId = useSelectedTeamId();
    const isEnabled = enabled && Boolean(teamId);
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const activityQuery = dailyActivityQuery({
        teamId: teamId ?? '',
        range,
        scope
    }, {
        enabled: isEnabled,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchInterval: isEnabled ? refetchIntervalMs ?? false : false,
        refetchIntervalInBackground: false
    });

    useEffect(() => {
        if(activityQuery.error){
            checkAccessDeniedError(activityQuery.error);
        }
    }, [activityQuery.error, checkAccessDeniedError]);

    return {
        activityData: activityQuery.data || [],
        isLoading: activityQuery.isLoading,
        error: activityQuery.error?.message ?? null,
        accessDenied,
        accessDeniedMessage,
        fetchActivity: () => activityQuery.refetch()
    };
};

export default useDailyActivityData;
