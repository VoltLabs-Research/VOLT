import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'container',
    tier: 'compute',
    requires: ['team', 'cluster'],
    optional: ['socket'],
    description: 'Execution containers'
});
