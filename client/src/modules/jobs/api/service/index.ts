import { defineServiceModule } from '@/shared/api/service-module';
import endpoints from './endpoints';

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/jobs',
            useRBAC: true
        }
    },
    endpoints
});
