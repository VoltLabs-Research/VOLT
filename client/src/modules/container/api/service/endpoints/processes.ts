import { get } from '@/app/core/http/utilities/create-service';
import type { ContainerRouteParams } from '../../dtos/container-route-params';

const endpoints = {
    getProcesses: get<ContainerRouteParams, string[][]>('/:containerId/processes', {
        unwrap: { field: 'processes' }
    })
};

export default endpoints;
