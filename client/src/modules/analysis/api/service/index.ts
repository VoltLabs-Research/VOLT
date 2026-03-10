import { defineServiceModule } from '@/shared/api/service-module';
import clients from './clients';
import endpoints from './endpoints';

export default defineServiceModule({
    clients,
    endpoints
});
