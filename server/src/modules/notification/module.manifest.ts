import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'notification',
    tier: 'capability',
    optional: ['socket'],
    description: 'User notifications'
});
