
import { createService, get } from '@/app/core/http/utils/create-service';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';

export interface GetDailyActivityParams {
    range?: number;
    scope?: 'team' | 'self';
}

const endpoints = {
    getDailyActivity: get<GetDailyActivityParams | undefined, DailyActivity[]>('/', {
        query: (params) => {
            if (!params) {
                return undefined;
            }

            return {
                ...(params.range ? { range: params.range } : {}),
                ...(params.scope ? { scope: params.scope } : {})
            };
        }
    })
};

export default createService({
    clients: {
        default: {
            basePath: '/daily-activities',
            useRBAC: true
        }
    }
}, endpoints);
