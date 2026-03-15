import { defineServiceModule } from '@/shared/api/service-module';
import client from './client';
import endpoints from './endpoints';

export default defineServiceModule({
    clients: client,
    endpoints
});
