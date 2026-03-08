import { get } from '@/app/core/http/utilities/create-service';
import type { DailyActivity } from '../../entities/daily-activity';
import type { GetDailyActivityParams } from '../../dtos/get-daily-activity';

const endpoints = {
    getDailyActivity: get<GetDailyActivityParams | undefined, DailyActivity[]>('/', {
        query: (params) => {
            let query: Pick<GetDailyActivityParams, 'range'> | undefined;

            if (params?.range) {
                query = { range: params.range };
            }

            return query;
        }
    })
};

export default endpoints;
