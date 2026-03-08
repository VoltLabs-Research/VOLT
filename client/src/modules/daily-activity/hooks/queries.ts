import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import service from '../api/service';
import type { GetDailyActivityParams } from '../api/dtos/get-daily-activity';

const KEYS = buildKeys<{
    activity: GetDailyActivityParams;
}>('daily-activity');

export const dailyActivityQuery = createQuery(KEYS.activity, service.getDailyActivity);