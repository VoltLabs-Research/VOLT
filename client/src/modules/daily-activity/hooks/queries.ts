import service from '../api/service';
import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import type { GetDailyActivityParams } from '../api/service';

interface DailyActivityQueryParams extends GetDailyActivityParams {
    teamId: string;
}

type DailyActivityQueryKeys = {
    activity: DailyActivityQueryParams;
};

const KEYS = buildKeys<DailyActivityQueryKeys>('daily-activity');

export const dailyActivityQuery = createQuery<DailyActivityQueryParams, Awaited<ReturnType<typeof service.getDailyActivity>>>(
    KEYS.activity,
    ({ range, scope }) => service.getDailyActivity({
        ...(range ? { range } : {}),
        ...(scope ? { scope } : {})
    })
);
