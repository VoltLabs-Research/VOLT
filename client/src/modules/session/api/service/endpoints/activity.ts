import { get } from '@/app/core/http/utilities/create-service';
import type { GetLoginActivityInputDTO, GetLoginActivityOutputDTO } from '../../dtos/get-login-activity';

const endpoints = {
    getLoginActivity: get<GetLoginActivityInputDTO | undefined, GetLoginActivityOutputDTO>('/activity', {
        query: (params) => ({ limit: params?.limit ?? 20 })
    })
};

export default endpoints;
