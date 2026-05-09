
import { createService, get } from '@/app/core/http/utilities/create-service';
import type { EmptyParams } from '@voltstack/voltclient';

export interface RBACResource {
    key: string;
    label: string;
}

export interface RBACAction {
    key: string;
    label: string;
}

export interface RBACConfig {
    resources: RBACResource[];
    actions: RBACAction[];
}

const endpoints = {
    getRBACConfig: get<EmptyParams, RBACConfig>('/rbac')
};

export default createService({
    clients: {
        default: {
            basePath: '/system'
        }
    }
}, endpoints);
