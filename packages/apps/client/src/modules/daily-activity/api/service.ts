
import { createService, get } from '@/app/core/http/utils/create-service';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';

export interface GetDailyActivityParams {
    range?: number;
    scope?: 'team' | 'self';
}

const endpoints = {
    getDailyActivity: get<GetDailyActivityParams, DailyActivity[]>('/daily-activities', {
        query: ({ range, scope }) => ({
            ...(range ? { range } : {}),
            ...(scope ? { scope } : {})
        })
    })
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
