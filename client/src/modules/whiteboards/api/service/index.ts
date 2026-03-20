import { defineServiceModule } from '@/shared/api/service-module';
import endpoints from './endpoints';

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/whiteboards',
            useRBAC: true
        }
    },
    endpoints
});
