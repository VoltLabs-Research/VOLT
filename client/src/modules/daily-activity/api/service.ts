
import { createService, get } from '@/app/core/http/utilities/create-service';
import type { DailyActivity } from './entities/daily-activity';

export interface GetDailyActivityParams {
    range?: number;
}

const endpoints = {
    getDailyActivity: get<GetDailyActivityParams | undefined, DailyActivity[]>('/', {
        query: (params) => params?.range ? { range: params.range } : undefined
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
