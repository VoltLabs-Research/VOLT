import service from '../api/service';
import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import type { GetDailyActivityParams } from '../api/service';

type DailyActivityQueryKeys = {
    activity: GetDailyActivityParams;
};

const KEYS = buildKeys<DailyActivityQueryKeys>('daily-activity');

export const dailyActivityQuery = createQuery(KEYS.activity, service.getDailyActivity);
