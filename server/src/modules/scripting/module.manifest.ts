import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'scripting',
    tier: 'leaf',
    requires: ['team', 'container'],
    optional: ['cluster'],
    description: 'Jupyter notebooks'
});
