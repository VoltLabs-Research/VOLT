import test from 'node:test';
import assert from 'node:assert/strict';

import { WorkflowEngine, type WorkflowExecutionRequest } from './WorkflowEngine';
import { WorkflowNodeRegistry } from './NodeRegistry';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { TrajectoryDumpDescriptor, TrajectoryFrame, WorkflowDefinition } from '@/modules/analysis/contracts/http-workflow';

/**
 * Characterization tests for {@link WorkflowEngine.planExecutionStrategy}.
 *
 * These lock in the OBSERVABLE planning contract (returned `items`,
 * `forEachNodeId` and `nodeOutputSnapshots` keys) so the Task 2 refactor that
 * extracts the shared {@link WorkflowPlanner} can be proven behavior-preserving:
 * the assertions below must hold byte-for-byte before AND after the change.
 */

const TRAJECTORY_ID = 'traj-1';

const FRAMES: TrajectoryFrame[] = [
    { timestep: 0, natoms: 10, simulationCell: 'cell-0' },
    { timestep: 10, natoms: 12, simulationCell: 'cell-10' }
];

// Mirrors WorkflowSession.resolveContextDumps for the default (no-override,
// all-frames) path so the expectation is derived, not hand-copied.
const expectedDumps = (): TrajectoryDumpDescriptor[] => FRAMES.map((frame) => ({
    ...frame,
    path: `trajectory-${TRAJECTORY_ID}/timestep-${frame.timestep}.dump.zst`
}));

const modifierNode = () => ({
    id: 'modifier-1',
    type: WorkflowNodeType.Modifier,
    position: { x: 0, y: 0 },
    data: { modifier: { name: 'Test Plugin', key: 'test' } }
});

const argumentsNode = () => ({
    id: 'arguments-1',
    type: WorkflowNodeType.Arguments,
    position: { x: 0, y: 0 },
    data: { arguments: { arguments: [] } }
});

const contextNode = () => ({
    id: 'context-1',
    type: WorkflowNodeType.Context,
    position: { x: 0, y: 0 },
    data: {}
});

const entrypointNode = () => ({
    id: 'entrypoint-1',
    type: WorkflowNodeType.Entrypoint,
    position: { x: 0, y: 0 },
    data: {
        entrypoint: {
            binaryObjectPath: 'plugins/demo/main',
            arguments: '--frame {{timestep}}'
        }
    }
});

const exposureNode = () => ({
    id: 'exposure-1',
    type: WorkflowNodeType.Exposure,
    position: { x: 0, y: 0 },
    data: { exposure: { name: 'result', results: '{{ entrypoint-1 }}' } }
});

// Modifier -> Arguments -> Context -> ForEach -> Entrypoint -> Exposure
const buildForEachWorkflow = (): WorkflowDefinition => ({
    nodes: [
        modifierNode(),
        argumentsNode(),
        contextNode(),
        {
            id: 'foreach-1',
            type: WorkflowNodeType.ForEach,
            position: { x: 0, y: 0 },
            data: { forEach: { iterableSource: '{{ context.trajectory_dumps }}' } }
        },
        entrypointNode(),
        exposureNode()
    ],
    edges: [
        { source: 'modifier-1', target: 'arguments-1' },
        { source: 'arguments-1', target: 'context-1' },
        { source: 'context-1', target: 'foreach-1' },
        { source: 'foreach-1', target: 'entrypoint-1' },
        { source: 'entrypoint-1', target: 'exposure-1' }
    ]
});

// Modifier -> Arguments -> Context -> Entrypoint -> Exposure (no ForEach)
const buildContextOnlyWorkflow = (): WorkflowDefinition => ({
    nodes: [
        modifierNode(),
        argumentsNode(),
        contextNode(),
        entrypointNode(),
        exposureNode()
    ],
    edges: [
        { source: 'modifier-1', target: 'arguments-1' },
        { source: 'arguments-1', target: 'context-1' },
        { source: 'context-1', target: 'entrypoint-1' },
        { source: 'entrypoint-1', target: 'exposure-1' }
    ]
});

const buildRequest = (workflow: WorkflowDefinition): WorkflowExecutionRequest => ({
    workflow,
    trajectoryId: TRAJECTORY_ID,
    trajectoryFrames: FRAMES,
    analysis: { _id: 'analysis-doc-1', pluginDisplayName: 'Test Plugin' },
    analysisId: 'analysis-1',
    pluginId: 'plugin-1',
    userConfig: {},
    teamId: 'team-1'
});

const createEngine = (): WorkflowEngine => new WorkflowEngine(WorkflowNodeRegistry.createDefault());

test('planExecutionStrategy (with ForEach): items come from the ForEach output and forEachNodeId is set', async () => {
    const plan = await createEngine().planExecutionStrategy(buildRequest(buildForEachWorkflow()));

    assert.ok(plan, 'expected a non-null plan');
    assert.equal(plan!.forEachNodeId, 'foreach-1');
    assert.deepEqual(plan!.items, expectedDumps());
});

test('planExecutionStrategy (with ForEach): snapshots exactly the executed planning nodes', async () => {
    const plan = await createEngine().planExecutionStrategy(buildRequest(buildForEachWorkflow()));

    // Runtime nodes (entrypoint/exposure) are skipped during planning and never
    // reached because traversal stops after ForEach.
    assert.deepEqual(
        Object.keys(plan!.nodeOutputSnapshots).sort(),
        ['arguments-1', 'context-1', 'foreach-1', 'modifier-1']
    );
});

test('planExecutionStrategy (context-only, no ForEach): items come from context dumps and forEachNodeId is absent', async () => {
    const plan = await createEngine().planExecutionStrategy(buildRequest(buildContextOnlyWorkflow()));

    assert.ok(plan, 'expected a non-null plan');
    assert.equal(plan!.forEachNodeId, undefined);
    assert.deepEqual(plan!.items, expectedDumps());
});

test('planExecutionStrategy (context-only, no ForEach): snapshots the executed planning nodes only', async () => {
    const plan = await createEngine().planExecutionStrategy(buildRequest(buildContextOnlyWorkflow()));

    assert.deepEqual(
        Object.keys(plan!.nodeOutputSnapshots).sort(),
        ['arguments-1', 'context-1', 'modifier-1']
    );
});
