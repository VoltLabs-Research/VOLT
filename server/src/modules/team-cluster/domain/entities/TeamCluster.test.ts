import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTeamClusterEffectiveCapabilities } from './TeamCluster';

test('compute-node keeps storage reads enabled while refusing new storage writes', () => {
    const capabilities = buildTeamClusterEffectiveCapabilities('compute-node');

    assert.equal(capabilities.acceptsComputeJobs, true);
    assert.equal(capabilities.acceptsStorageWrites, false);
    assert.equal(capabilities.servesStorageReads, true);
    assert.equal(capabilities.servesArtifactDownloads, true);
});
