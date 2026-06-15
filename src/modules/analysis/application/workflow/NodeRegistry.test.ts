import test from 'node:test';
import assert from 'node:assert/strict';
import {
    WORKFLOW_NODE_PHASE,
    WorkflowNodeRegistry,
    isPlanningNodeType
} from './NodeRegistry';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

const ALL_NODE_TYPES = Object.values(WorkflowNodeType);

// The canonical planning set. This is the single behavioral contract that the
// WORKFLOW_NODE_PHASE map, the registry accessors and the node handlers must
// all agree on.
const EXPECTED_PLANNING_NODE_TYPES = [
    WorkflowNodeType.Modifier,
    WorkflowNodeType.Arguments,
    WorkflowNodeType.Context,
    WorkflowNodeType.ForEach,
    WorkflowNodeType.TrajectoryWindow
];

test('WORKFLOW_NODE_PHASE planning set is exactly {Modifier, Arguments, Context, ForEach, TrajectoryWindow}', () => {
    const planning = (Object.keys(WORKFLOW_NODE_PHASE) as WorkflowNodeType[])
        .filter((type) => WORKFLOW_NODE_PHASE[type] === 'planning');

    assert.deepEqual(
        [...planning].sort(),
        [...EXPECTED_PLANNING_NODE_TYPES].sort(),
        'planning node set drifted from the canonical contract'
    );
});

test('every WorkflowNodeType has a defined planning/runtime phase', () => {
    for (const type of ALL_NODE_TYPES) {
        const phase = WORKFLOW_NODE_PHASE[type];
        assert.ok(
            phase === 'planning' || phase === 'runtime',
            `node type "${type}" has no valid phase (got ${String(phase)})`
        );
    }
});

test('WORKFLOW_NODE_PHASE marks planning types as planning and the rest as runtime', () => {
    for (const type of ALL_NODE_TYPES) {
        const expected = EXPECTED_PLANNING_NODE_TYPES.includes(type) ? 'planning' : 'runtime';
        assert.equal(WORKFLOW_NODE_PHASE[type], expected, `unexpected phase for "${type}"`);
    }
});

test('isPlanningNodeType agrees with WORKFLOW_NODE_PHASE for every node type', () => {
    for (const type of ALL_NODE_TYPES) {
        const expected = WORKFLOW_NODE_PHASE[type] === 'planning';
        assert.equal(isPlanningNodeType(type), expected, `isPlanningNodeType("${type}")`);
    }
});

test('createDefault() instantiates handlers (phase derived from the map) and registers the planning handlers', () => {
    // createDefault() constructs every handler; each handler initializes its
    // `phase` field from WORKFLOW_NODE_PHASE, so a successful construction also
    // proves that wiring resolves at runtime. Plugin/Export are intentionally
    // engine-handled and not registered here.
    const registry = WorkflowNodeRegistry.createDefault();

    for (const type of EXPECTED_PLANNING_NODE_TYPES) {
        assert.ok(registry.has(type), `missing registered handler for planning node "${type}"`);
    }
});
