import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'daily-activity',
    tier: 'leaf',
    requires: ['team'],
    description: 'Activity log'
});
