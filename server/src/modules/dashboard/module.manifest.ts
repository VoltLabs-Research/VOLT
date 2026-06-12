import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'dashboard',
    tier: 'leaf',
    requires: ['team'],
    optional: ['analysis', 'chat', 'container', 'plugin', 'trajectory'],
    description: 'Dashboard aggregation'
});
