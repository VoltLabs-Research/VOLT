import { defineModule } from '@shared/infrastructure/modules/defineModule';

/**
 * Detachable-module manifest for `analysis` (plugin analysis runs over MD
 * trajectories). Compute-tier feature: hard-requires team (kernel) and
 * trajectory (analyses belong to a trajectory); degrades gracefully without
 * socket (live log streaming), cluster (remote storage cleanup), and jobs
 * (frame retry / job-history maintenance).
 */
export default defineModule({
    key: 'analysis',
    tier: 'compute',
    requires: ['team', 'trajectory'],
    optional: ['socket', 'cluster', 'jobs'],
    description: 'Plugin analysis runs'
});
