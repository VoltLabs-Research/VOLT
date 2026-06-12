import { defineModule } from '@shared/infrastructure/modules/defineModule';

export default defineModule({
    key: 'raster',
    tier: 'compute',
    requires: ['team', 'trajectory'],
    optional: ['cluster', 'container'],
    description: 'Offscreen rasterization'
});
