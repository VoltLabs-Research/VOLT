import client from './client';
import endpoints from './endpoints';
import { defineServiceModule } from '@/shared/api/service-module';

export default defineServiceModule({
    clients: client,
    endpoints
});
