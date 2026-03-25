import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId,
    resolveClusterReferenceId,
    resolveSceneArtifactStorageClusterId,
    resolveTrajectoryStorageClusterId
} from './cluster-location';

test('cluster-location resolves canonical storage and compute ids without legacy fallback', () => {
    assert.equal(resolveTrajectoryStorageClusterId({
        storageClusterId: 'storage-1'
    }), 'storage-1');

    assert.equal(resolveAnalysisComputeClusterId({
        computeClusterId: 'compute-1'
    }), 'compute-1');

    assert.equal(resolveAnalysisStorageClusterId(
        { storageClusterId: 'analysis-storage' }
    ), 'analysis-storage');

    assert.equal(resolveSceneArtifactStorageClusterId({
        storageClusterId: { _id: 'artifact-storage' } as any
    } as any), 'artifact-storage');

    assert.equal(resolveClusterReferenceId({ _id: 'cluster-ref' }), 'cluster-ref');
});
