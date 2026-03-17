import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkflowNodeRegistry } from '@/modules/workflow-runtime/factories';
import { WorkflowEngine } from './WorkflowEngine';

test('WorkflowEngine returns a batch plan when workflow has no ForEach node', async () => {
    const workflowEngine = new WorkflowEngine(createWorkflowNodeRegistry());
    const workflow = {
        nodes: [{
            id: 'context',
            type: 'context',
            position: { x: 0, y: 0 },
            data: {}
        }, {
            id: 'entrypoint',
            type: 'entrypoint',
            position: { x: 0, y: 0 },
            data: {
                entrypoint: {
                    binaryObjectPath: 'plugins/multisom.bin',
                    arguments: '--input {{ context.allDumpLocalPaths }}'
                }
            }
        }],
        edges: [{
            source: 'context',
            target: 'entrypoint'
        }]
    };

    const plan = await workflowEngine.planExecutionStrategy({
        workflow,
        nestedPlugins: [],
        trajectoryId: 'trajectory-1',
        trajectoryFrames: [{
            timestep: 10,
            natoms: 42,
            simulationCell: 'cell-a'
        }, {
            timestep: 20,
            natoms: 42,
            simulationCell: 'cell-b'
        }],
        analysis: {
            _id: 'analysis-1',
            pluginDisplayName: 'MultiSOM'
        },
        analysisId: 'analysis-1',
        pluginId: 'multisom',
        userConfig: {},
        teamId: 'team-1'
    });

    assert.ok(plan);
    assert.equal(plan?.batchMode, true);
    assert.equal(plan?.forEachNodeId, undefined);
    assert.equal(plan?.contextNodeId, 'context');
    assert.deepEqual(plan?.items, [{
        timestep: 10,
        natoms: 42,
        simulationCell: 'cell-a',
        path: 'trajectory-trajectory-1/timestep-10.dump.gz'
    }, {
        timestep: 20,
        natoms: 42,
        simulationCell: 'cell-b',
        path: 'trajectory-trajectory-1/timestep-20.dump.gz'
    }]);
});
