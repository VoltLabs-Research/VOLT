import endpoints from './endpoints';
import { defineServiceModule } from '@/shared/api/service-module';

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/plugins',
            useRBAC: true
        },
        teamClusters: {
            basePath: '/teams',
            useRBAC: false
        }
    },
    endpoints
});
