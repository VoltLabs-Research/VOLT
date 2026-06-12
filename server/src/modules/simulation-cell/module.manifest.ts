import { defineModule } from '@shared/infrastructure/modules/defineModule';

/**
 * Detachable-module manifest for `simulation-cell` (per-trajectory simulation
 * cell library). Compute-tier: hard-requires team (kernel) and degrades
 * gracefully without the optional trajectory module.
 */
export default defineModule({
    key: 'simulation-cell',
    tier: 'compute',
    requires: ['team'],
    optional: ['trajectory'],
    description: 'Simulation cell library'
});
