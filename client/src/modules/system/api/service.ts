
import { createService, get } from '@/app/core/http/utilities/create-service';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { GetRBACConfigOutputDTO } from './dtos/get-rbac-config';

const endpoints = {
    getRBACConfig: get<EmptyParams, GetRBACConfigOutputDTO>('/rbac')
};

export default createService({
    clients: {
        default: {
            basePath: '/system'
        }
    }
}, endpoints);
