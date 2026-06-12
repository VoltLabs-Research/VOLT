import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'latex',
    tier: 'leaf',
    requires: ['team'],
    optional: ['ai', 'cluster', 'container', 'socket'],
    description: 'LaTeX documents + compilation'
});
