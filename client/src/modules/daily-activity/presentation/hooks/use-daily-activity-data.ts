import { useState, useCallback, useRef } from 'react';
import useDailyActivityUseCases from './use-daily-activity-use-cases';
import type { DailyActivity } from '@/modules/daily-activity/domain/entities';

const DEFAULT_RANGE = 365;

const useDailyActivityData = () => {
    const [activityData, setActivityData] = useState<DailyActivity[]>([]);
    const [isLoading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isLoadingRef = useRef(false);

    const { dailyActivityRepository } = useDailyActivityUseCases();

    const fetchActivity = useCallback(async (range: number = DEFAULT_RANGE) => {
        if(isLoadingRef.current) return;

        isLoadingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const data = await dailyActivityRepository.getTeamActivity({ range });
            setActivityData(data);
        } catch(err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch activity';
            setError(message);
        } finally {
            isLoadingRef.current = false;
            setLoading(false);
        }
    }, [dailyActivityRepository]);

    return {
        activityData,
        isLoading,
        error,
        fetchActivity
    };
};

export default useDailyActivityData;
