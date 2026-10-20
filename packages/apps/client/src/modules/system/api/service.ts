import { createService, get } from '@/app/core/http/utils/create-service';
import type { EmptyParams } from '@voltstack/voltclient';
import type { RbacConfig, SystemConfig } from '@volt/contracts/modules/system/domain';

const endpoints = {
    getRBACConfig: get<EmptyParams, RbacConfig>('/rbac'),
    getDeploymentConfig: get<EmptyParams, SystemConfig>('/config')
};

export default createService({
    clients: {
        default: {
            basePath: '/system'
        }
    }
}, endpoints);
