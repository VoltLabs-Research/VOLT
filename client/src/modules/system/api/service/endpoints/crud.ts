import { get, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { RBACConfig } from '../../entities/rbac';

const endpoints = {
    getRBACConfig: get<EmptyParams, RBACConfig>('/rbac')
};

export default endpoints;
