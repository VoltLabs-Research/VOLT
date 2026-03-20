import { defineServiceModule } from '@/shared/api/service-module';
import endpoints from './endpoints';
import type { TriggerRasterizationParams } from '@/modules/raster/api/dtos';

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/rasters',
            useRBAC: true
        },
        scoped: {
            basePath: '/rasters',
            useRBAC: true,
            getTeamId: (params: TriggerRasterizationParams) => params.teamId
        }
    },
    endpoints
});
