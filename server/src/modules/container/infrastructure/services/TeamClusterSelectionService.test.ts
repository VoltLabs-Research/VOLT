import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { TeamClusterSelectionService } from './TeamClusterSelectionService';

test('TeamClusterSelectionService resolves generic team clusters without compute-role requirements', async () => {
    const calls: Array<{ method: string; input: Record<string, unknown>; }> = [];
    const service = new TeamClusterSelectionService({
        resolveConnectedClusterId: async (input: Record<string, unknown>) => {
            calls.push({ method: 'connected', input });
            return 'connected-cluster';
        },
        resolveComputeClusterId: async (input: Record<string, unknown>) => {
            calls.push({ method: 'compute', input });
            return 'compute-cluster';
        },
        resolveStorageClusterId: async () => 'storage-cluster'
    } as never);

    const resolvedClusterId = await service.resolveTeamClusterId('team-1', 'cluster-1');

    assert.equal(resolvedClusterId, 'connected-cluster');
    assert.deepEqual(calls, [{
        method: 'connected',
        input: {
            teamId: 'team-1',
            requestedTeamClusterId: 'cluster-1'
        }
    }]);
});

test('TeamClusterSelectionService still resolves compute clusters explicitly when required', async () => {
    const calls: Array<{ method: string; input: Record<string, unknown>; }> = [];
    const service = new TeamClusterSelectionService({
        resolveConnectedClusterId: async () => 'connected-cluster',
        resolveComputeClusterId: async (input: Record<string, unknown>) => {
            calls.push({ method: 'compute', input });
            return 'compute-cluster';
        },
        resolveStorageClusterId: async () => 'storage-cluster'
    } as never);

    const resolvedClusterId = await service.resolveComputeClusterId('team-1', 'cluster-1', 'storage-1');

    assert.equal(resolvedClusterId, 'compute-cluster');
    assert.deepEqual(calls, [{
        method: 'compute',
        input: {
            teamId: 'team-1',
            requestedTeamClusterId: 'cluster-1',
            preferredStorageClusterId: 'storage-1'
        }
    }]);
});
