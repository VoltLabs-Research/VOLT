import endpoints from './endpoints';
import { defineServiceModule } from '@/shared/api/service-module';

export default defineServiceModule({
    clients: {
        team: {
            basePath: '/teams',
            useRBAC: false
        },
        invitations: {
            basePath: '/teams/invitations',
            useRBAC: false
        }
    },
    endpoints
});
