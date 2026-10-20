import service from '../api/service';
import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
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
