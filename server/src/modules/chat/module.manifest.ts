import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'chat',
    tier: 'leaf',
    requires: ['team'],
    optional: ['socket'],
    description: 'Team chat'
});
