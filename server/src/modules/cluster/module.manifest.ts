import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'cluster',
    tier: 'compute',
    requires: ['team'],
    optional: ['socket', 'analysis', 'trajectory'],
    description: 'User compute clusters + object gateway'
});
