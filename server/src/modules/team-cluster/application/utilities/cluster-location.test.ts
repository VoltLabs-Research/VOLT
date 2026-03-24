import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId,
    resolveClusterReferenceId,
    resolveSceneArtifactStorageClusterId,
    resolveTrajectoryStorageClusterId
} from './cluster-location';

test('cluster-location prefers explicit storage and compute ids with legacy fallbacks', () => {
    assert.equal(resolveTrajectoryStorageClusterId({
        storageClusterId: 'storage-1',
        teamCluster: 'legacy-storage'
    }), 'storage-1');
    assert.equal(resolveTrajectoryStorageClusterId({
        teamCluster: 'legacy-storage'
    }), 'legacy-storage');

    assert.equal(resolveAnalysisComputeClusterId({
        computeClusterId: 'compute-1',
        teamCluster: 'legacy-compute'
    }), 'compute-1');
    assert.equal(resolveAnalysisComputeClusterId({
        teamCluster: 'legacy-compute'
    }), 'legacy-compute');

    assert.equal(resolveAnalysisStorageClusterId(
        { storageClusterId: undefined },
        { storageClusterId: 'trajectory-storage', teamCluster: 'legacy-storage' }
    ), 'trajectory-storage');
    assert.equal(resolveAnalysisStorageClusterId(
        { storageClusterId: 'analysis-storage' },
        { storageClusterId: 'trajectory-storage', teamCluster: 'legacy-storage' }
    ), 'analysis-storage');

    assert.equal(resolveSceneArtifactStorageClusterId({
        storageClusterId: undefined,
        teamCluster: { _id: 'artifact-storage' } as any
    } as any), 'artifact-storage');

    assert.equal(resolveClusterReferenceId({ _id: 'cluster-ref' }), 'cluster-ref');
});
