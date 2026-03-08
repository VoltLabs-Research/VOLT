import { get } from '@/app/core/http/utilities/create-service';
import type { DailyActivity } from '../../entities/daily-activity';
import type { GetDailyActivityParams } from '../../dtos/get-daily-activity';

const endpoints = {
    getDailyActivity: get<GetDailyActivityParams | undefined, DailyActivity[]>('/', {
        query: (params) => params?.range ? { range: params.range } : undefined
    })
};

export default endpoints;
