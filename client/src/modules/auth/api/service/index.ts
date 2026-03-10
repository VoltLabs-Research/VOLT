import { defineServiceModule } from '@/shared/api/service-module';
import clients from './client';
import endpoints from './endpoints';

export default defineServiceModule({
    clients,
    endpoints
});
