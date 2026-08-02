import service from '../api/service';
import { buildKeys, createQuery } from '@/shared/query';
import type { GetDailyActivityParams } from '../api/service';

interface DailyActivityQueryParams extends GetDailyActivityParams {
    teamId: string;
}

const KEYS = buildKeys<{
    activity: DailyActivityQueryParams;
}>('daily-activity');

export const dailyActivityQuery = createQuery(
    KEYS.activity,
    ({ range, scope }) => service.getDailyActivity({
        range,
        scope
    })
);
