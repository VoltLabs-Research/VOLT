import type { TriggerRasterizationParams } from '@/modules/raster/api/dtos';

const client = {
    default: {
        basePath: '/rasters',
        useRBAC: true
    },
    scoped: {
        basePath: '/rasters',
        useRBAC: true,
        getTeamId: (params: TriggerRasterizationParams) => params.teamId
    }
};

export default client;
