import { defineServiceModule } from '@/shared/api/service-module';
import { get } from '@/app/core/http/utilities/create-service';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { GetRBACConfigOutputDTO } from './dtos/get-rbac-config';

const endpoints = {
    getRBACConfig: get<EmptyParams, GetRBACConfigOutputDTO>('/rbac')
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/system'
        }
    },
    endpoints
});
