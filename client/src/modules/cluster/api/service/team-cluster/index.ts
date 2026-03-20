import { defineServiceModule } from '@/shared/api/service-module';
import endpoints from './endpoints';

const client = {
    default: {
        basePath: '/teams'
    }
};

export const teamClusterService = defineServiceModule({
    clients: client,
    endpoints
});
