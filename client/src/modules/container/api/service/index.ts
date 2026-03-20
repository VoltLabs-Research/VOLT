import endpoints from './endpoints';
import { defineServiceModule } from '@/shared/api/service-module';
import type { CreateContainerParams } from '../dtos/create-container';

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/containers',
            useRBAC: true
        },
        scoped: {
            basePath: '/containers',
            useRBAC: true,
            getTeamId: (params: CreateContainerParams) => params.teamId
        }
    },
    endpoints
});
