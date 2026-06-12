import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'jobs',
    tier: 'capability',
    requires: ['team'],
    optional: ['socket', 'trajectory'],
    description: 'Background job tracking'
});
