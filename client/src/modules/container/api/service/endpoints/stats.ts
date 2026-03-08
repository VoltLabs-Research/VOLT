import { get } from '@/app/core/http/utilities/create-service';
import type { ContainerStatsResponse } from '../../entities/container-stats';

const endpoints = {
    getStats: get<{ containerId: string }, ContainerStatsResponse>('/:containerId/stats', {
        map: (result) => {
            const data = result as { stats: ContainerStatsResponse['stats']; limits: ContainerStatsResponse['limits'] };
            return { stats: data.stats, limits: data.limits };
        }
    }),
    getProcesses: get<{ containerId: string }, string[][]>('/:containerId/processes', {
        unwrap: { field: 'processes' }
    })
};

export default endpoints;