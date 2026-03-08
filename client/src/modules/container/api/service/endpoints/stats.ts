import { get } from '@/app/core/http/utilities/create-service';
import type { ContainerRouteParams } from '../../dtos/container-route-params';
import type { ContainerStatsResponse } from '../../entities/container-stats';

const endpoints = {
    getStats: get<ContainerRouteParams, ContainerStatsResponse>('/:containerId/stats')
};

export default endpoints;
