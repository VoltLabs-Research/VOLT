import { defineServiceModule } from '@/shared/api/service-module';
import client from './client';
import endpoints from './endpoints';

export const teamClusterService = defineServiceModule({
    clients: client,
    endpoints
});
