import { get } from '@/app/core/http/utilities/create-service';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { GetRBACConfigOutputDTO } from '../../dtos/get-rbac-config';

export default {
    getRBACConfig: get<EmptyParams, GetRBACConfigOutputDTO>('/rbac')
};
