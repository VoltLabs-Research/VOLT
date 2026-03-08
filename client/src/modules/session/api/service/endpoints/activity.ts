import { get } from '@/app/core/http/utilities/create-service';
import type { GetLoginActivityOutputDTO } from '../../dtos/get-login-activity';

const endpoints = {
    getLoginActivity: get<{ limit?: number } | undefined, GetLoginActivityOutputDTO>('/activity', {
        query: (params) => ({ limit: params?.limit ?? 20 })
    })
};

export default endpoints;
