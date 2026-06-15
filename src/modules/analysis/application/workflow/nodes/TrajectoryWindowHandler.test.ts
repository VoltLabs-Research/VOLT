import test from 'node:test';
import assert from 'node:assert/strict';

import { WorkflowTrajectoryWindowHandler } from './TrajectoryWindowHandler';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type { WorkflowExecutionContext, WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import type { TrajectoryDumpDescriptor, WorkflowTrajectoryWindowData } from '@/modules/analysis/contracts/http-workflow';

const TIMESTEPS = [0, 10, 20, 30, 40];

const buildDescriptors = (timesteps: number[]): TrajectoryDumpDescriptor[] =>
    timesteps.map((timestep) => ({
        timestep,
        natoms: 100,
        simulationCell: '0 10 0 10 0 10',
        path: `trajectory-traj-1/timestep-${timestep}.dump.zst`
    }));

const buildNode = (data: WorkflowTrajectoryWindowData): WorkflowNode => ({
    id: 'trajectory-window',
    type: WorkflowNodeType.TrajectoryWindow,
    position: { x: 0, y: 0 },
    data: { trajectoryWindow: data }
});

const buildContext = (overrides: Partial<WorkflowExecutionContext> = {}): WorkflowExecutionContext => ({
    outputs: new Map(),
    userConfig: {},
    runtimeArguments: {},
    trajectoryId: 'traj-1',
    trajectoryFrames: TIMESTEPS.map((timestep) => ({ timestep, natoms: 100, simulationCell: '0 10 0 10 0 10' })),
    analysis: { _id: 'analysis-1', pluginDisplayName: 'Window Plugin' },
    analysisId: 'analysis-1',
    generatedFiles: [],
    pluginId: 'plugin-1',
    teamId: 'team-1',
    workflow: undefined as never,
    nestedWorkflows: new Map(),
    ...overrides
});

// --- planItems (planner fan-out math) -------------------------------------

test('planItems mode:all yields a single job carrying every timestep', () => {
    const items = WorkflowTrajectoryWindowHandler.planItems({ mode: 'all' }, TIMESTEPS);

    assert.equal(items.length, 1);
    assert.equal(items[0].primaryTimestep, 0);
    assert.deepEqual(items[0].windowTimesteps, TIMESTEPS);
});

test('planItems mode:window size 3 yields one job per primary frame, clamped at ends', () => {
    const items = WorkflowTrajectoryWindowHandler.planItems(
        { mode: 'window', windowSize: 3, centered: true },
        TIMESTEPS
    );

    assert.equal(items.length, TIMESTEPS.length);
    // Each centered 3-window clamps at the trajectory ends.
    assert.deepEqual(items.map((item) => item.windowTimesteps), [
        [0, 10, 20],   // primary 0 clamps forward
        [0, 10, 20],   // primary 10 centered
        [10, 20, 30],  // primary 20 centered
        [20, 30, 40],  // primary 30 centered
        [20, 30, 40]   // primary 40 clamps backward
    ]);
    assert.deepEqual(items.map((item) => item.primaryTimestep), TIMESTEPS);
});

test('planItems mode:window trailing (centered:false) takes the window ending at the primary', () => {
    const items = WorkflowTrajectoryWindowHandler.planItems(
        { mode: 'window', windowSize: 3, centered: false },
        TIMESTEPS
    );

    assert.deepEqual(items.map((item) => item.windowTimesteps), [
        [0, 10, 20],   // clamped: cannot trail before frame 0
        [0, 10, 20],
        [0, 10, 20],
        [10, 20, 30],
        [20, 30, 40]
    ]);
});

test('planItems mode:referencePair pairs each primary frame with the reference timestep', () => {
    const items = WorkflowTrajectoryWindowHandler.planItems(
        { mode: 'referencePair', referenceTimestep: 0 },
        TIMESTEPS
    );

    assert.equal(items.length, TIMESTEPS.length);
    assert.deepEqual(items[0].windowTimesteps, [0]); // reference == primary collapses to one
    assert.deepEqual(items[2].windowTimesteps, [0, 20]);
    assert.deepEqual(items[4].windowTimesteps, [0, 40]);
});

test('planItems returns no jobs for an empty trajectory', () => {
    assert.deepEqual(WorkflowTrajectoryWindowHandler.planItems({ mode: 'all' }, []), []);
});

test('planItems clamps windowSize larger than the trajectory length', () => {
    const items = WorkflowTrajectoryWindowHandler.planItems(
        { mode: 'window', windowSize: 99, centered: true },
        TIMESTEPS
    );
    for (const item of items) {
        assert.deepEqual(item.windowTimesteps, TIMESTEPS);
    }
});

// --- execute() runtime localization ---------------------------------------

test('execute resolves localized window frames + primary pointer for the current job', async () => {
    const handler = new WorkflowTrajectoryWindowHandler();
    const windowFrames = buildDescriptors([10, 20, 30]).map((frame) => ({
        ...frame,
        path: `/local/${frame.timestep}.dump`
    }));
    const context = buildContext({ windowFrames, primaryFrameIndex: 1 });

    const output = await handler.execute(buildNode({ mode: 'window', windowSize: 3 }), context);

    assert.equal(output.count, 3);
    assert.equal(output.primaryIndex, 1);
    assert.equal(output.primaryValue?.timestep, 20);
    assert.equal(output.framePaths, '/local/10.dump /local/20.dump /local/30.dump');
});

test('execute referencePair points primaryValue at the last (current) frame', async () => {
    const handler = new WorkflowTrajectoryWindowHandler();
    const windowFrames = buildDescriptors([0, 40]).map((frame) => ({
        ...frame,
        path: `/local/${frame.timestep}.dump`
    }));
    const context = buildContext({ windowFrames });

    const output = await handler.execute(buildNode({ mode: 'referencePair', referenceTimestep: 0 }), context);

    assert.equal(output.primaryIndex, 1);
    assert.equal(output.primaryValue?.timestep, 40);
});

test('execute throws when the window mode is missing', async () => {
    const handler = new WorkflowTrajectoryWindowHandler();
    const node: WorkflowNode = {
        id: 'trajectory-window',
        type: WorkflowNodeType.TrajectoryWindow,
        position: { x: 0, y: 0 },
        data: {}
    };

    assert.throws(() => handler.execute(node, buildContext()), /requires a window mode/);
});
