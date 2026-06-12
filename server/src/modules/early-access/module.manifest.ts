import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'early-access',
    tier: 'leaf',
    optional: ['team'],
    description: 'Early-access gating'
});
