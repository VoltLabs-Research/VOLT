import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'plugin',
    tier: 'compute',
    requires: ['team'],
    optional: ['trajectory', 'analysis', 'cluster', 'container', 'socket'],
    description: 'Analysis plugins + registry'
});
