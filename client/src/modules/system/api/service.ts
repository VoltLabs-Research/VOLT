
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

export interface DeploymentConfig {
    mode: 'local' | 'cloud';
}

const endpoints = {
    getRBACConfig: get<EmptyParams, RBACConfig>('/rbac'),
    getDeploymentConfig: get<EmptyParams, DeploymentConfig>('/config')
};

export default createService({
    clients: {
        default: {
            basePath: '/system'
        }
    }
}, endpoints);
