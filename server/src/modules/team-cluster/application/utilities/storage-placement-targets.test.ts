import assert from 'node:assert/strict';
import test from 'node:test';
import { SYS_BUCKETS } from '@core/config/minio';
import {
    buildAnalysisPlacementBuckets,
    buildPluginBinaryPlacementBuckets,
    buildTrajectoryPlacementBuckets
} from './storage-placement-targets';

test('storage-placement-targets map trajectory, analysis and plugin-binary scopes to stable bucket prefixes', () => {
    assert.deepEqual(buildTrajectoryPlacementBuckets('traj-1'), [
        { bucket: SYS_BUCKETS.DUMPS, prefix: 'trajectory-traj-1/' },
        { bucket: SYS_BUCKETS.MODELS, prefix: 'trajectory-traj-1/' },
        { bucket: SYS_BUCKETS.RASTERIZER, prefix: 'trajectory-traj-1/' },
        { bucket: SYS_BUCKETS.PLUGINS, prefix: 'trajectory-traj-1/' },
        { bucket: SYS_BUCKETS.PLUGINS, prefix: 'plugins/trajectory-traj-1/' }
    ]);

    assert.deepEqual(buildAnalysisPlacementBuckets('traj-1', 'analysis-1'), [
        { bucket: SYS_BUCKETS.PLUGINS, prefix: 'plugins/trajectory-traj-1/analysis-analysis-1/' },
        { bucket: SYS_BUCKETS.PLUGINS, prefix: 'trajectory-traj-1/analysis-analysis-1/' },
        { bucket: SYS_BUCKETS.MODELS, prefix: 'trajectory-traj-1/analysis-analysis-1/' },
        { bucket: SYS_BUCKETS.RASTERIZER, prefix: 'trajectory-traj-1/analysis-analysis-1/' }
    ]);

    assert.deepEqual(buildPluginBinaryPlacementBuckets('plugin-1'), [
        { bucket: SYS_BUCKETS.PLUGINS, prefix: 'plugin-binaries/plugin-1/' }
    ]);
});
