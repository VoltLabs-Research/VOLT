import { createService, get, post } from '@/app/core/http/utils/create-service';
import type { EmptyParams } from '@voltstack/voltclient';
import type { SystemConfig, SystemUpdateStatus } from '@volt/contracts/modules/system/domain';

const endpoints = {
    getDeploymentConfig: get<EmptyParams, SystemConfig>('/config'),
    getUpdateStatus: get<EmptyParams, SystemUpdateStatus>('/update'),
    applyUpdate: post<EmptyParams, SystemUpdateStatus>('/update')
};

export default createService({
    clients: {
        default: {
            basePath: '/system'
        }
    }
}, endpoints);
