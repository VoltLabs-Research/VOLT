import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildInferFromContextArgs,
    collectInferFromContextArgumentKeys,
    createPipelineContext,
    registerSharedExposure,
    resolveSharedExposure
} from '@/modules/analysis/application/analysis/pipeline-context';
import {
    buildMergeArgs,
    buildSelectArgs,
    buildSliceArgs
} from '@/modules/analysis/application/analysis/dump-transform';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowDefinition } from '@/modules/analysis/contracts/http-workflow';

test('registerSharedExposure normalizes hyphens to underscores on write and read', () => {
    const context = createPipelineContext('/tmp/pipeline');

    registerSharedExposure(context, 'clusters-table', '/tmp/pipeline/clusters.table');

    assert.equal(resolveSharedExposure(context, 'clusters-table'), '/tmp/pipeline/clusters.table');
    assert.equal(resolveSharedExposure(context, 'clusters_table'), '/tmp/pipeline/clusters.table');
    assert.deepEqual(Object.keys(context.sharedExposures), ['clusters_table']);
});

test('registerSharedExposure ignores empty exposure ids and the latest producer wins', () => {
    const context = createPipelineContext('/tmp/pipeline');

    registerSharedExposure(context, '', '/tmp/ignored');
    assert.deepEqual(context.sharedExposures, {});

    registerSharedExposure(context, 'ptm_table', '/tmp/first');
    registerSharedExposure(context, 'ptm-table', '/tmp/second');
    assert.equal(resolveSharedExposure(context, 'ptm_table'), '/tmp/second');
});

test('buildInferFromContextArgs emits --key path pairs using the requested spelling', () => {
    const context = createPipelineContext('/tmp/pipeline');
    registerSharedExposure(context, 'clusters_table', '/tmp/pipeline/clusters.table');

    const args = buildInferFromContextArgs(context, ['clusters-table']);
    assert.deepEqual(args, ['--clusters-table', '/tmp/pipeline/clusters.table']);
});

test('buildInferFromContextArgs throws when a required upstream exposure is missing', () => {
    const context = createPipelineContext('/tmp/pipeline');

    assert.throws(
        () => buildInferFromContextArgs(context, ['missing_table']),
        /requires shared exposure "missing_table"/
    );
});

test('collectInferFromContextArgumentKeys returns only inferFromContext argument keys', () => {
    const workflow: WorkflowDefinition = {
        nodes: [
            {
                id: 'arguments-1',
                type: WorkflowNodeType.Arguments,
                position: { x: 0, y: 0 },
                data: {
                    arguments: {
                        arguments: [
                            { argument: 'cutoff', type: 'number' },
                            { argument: 'clusters_table', type: 'string', inferFromContext: true },
                            { argument: 'orientations', type: 'string', inferFromContext: true },
                            { type: 'string', inferFromContext: true }
                        ]
                    }
                }
            }
        ],
        edges: []
    };

    assert.deepEqual(
        collectInferFromContextArgumentKeys(workflow),
        ['clusters_table', 'orientations']
    );
});

test('collectInferFromContextArgumentKeys returns empty when there is no arguments node', () => {
    const workflow: WorkflowDefinition = { nodes: [], edges: [] };
    assert.deepEqual(collectInferFromContextArgumentKeys(workflow), []);
});

test('buildSliceArgs reads a {x,y,z} normal tuple, distance and reverseOrientation', () => {
    const args = buildSliceArgs({
        normal: { x: 1, y: 0, z: 0 },
        distance: 12.5,
        reverseOrientation: true
    });
    assert.deepEqual(args, ['--slice', '1,0,0,12.5,1']);
});

test('buildSliceArgs reads flat nx/ny/nz and defaults reverse to 0', () => {
    const args = buildSliceArgs({ nx: 0, ny: 2, nz: -1, distance: 0 });
    assert.deepEqual(args, ['--slice', '0,2,-1,0,0']);
});

test('buildSliceArgs accepts the reverse alias and string-encoded numbers', () => {
    const args = buildSliceArgs({ nx: '1', ny: '1', nz: '1', distance: '3', reverse: '1' });
    assert.deepEqual(args, ['--slice', '1,1,1,3,1']);
});

test('buildSelectArgs and buildMergeArgs pass their argument through verbatim', () => {
    assert.deepEqual(buildSelectArgs('Position.X > 0'), ['--select', 'Position.X > 0']);
    assert.deepEqual(buildMergeArgs('/tmp/props.parquet'), ['--merge', '/tmp/props.parquet']);
});
