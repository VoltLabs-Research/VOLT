import test from 'node:test';
import assert from 'node:assert/strict';

import { WorkflowPlanner } from './WorkflowPlanner';
import { WORKFLOW_NODE_PHASE, isPlanningNodeType } from './NodeRegistry';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput
} from '@/modules/analysis/contracts/workflow.types';
import type {
    WorkflowNodeExecutionResult,
    WorkflowNodeExecutor
} from './WorkflowNodeExecutor';

/**
 * Focused unit tests for the shared {@link WorkflowPlanner}. They drive the
 * planner with a recording fake executor so the traversal contract can be
 * asserted in isolation:
 *  - planning-phase nodes run in topological order,
 *  - traversal stops after the ForEach node,
 *  - the two-level skip model (silent skip-filter vs. hook-fired executor-skip),
 *  - and the hook points the nested caller relies on.
 */

// The planner never reads the context; the fake executor ignores it too.
const CONTEXT = {} as WorkflowExecutionContext;

// Mirrors the root skip-filter: defer side-effecting runtime nodes but still
// EVALUATE control-flow nodes during planning.
const PLANNING_EVALUATED_RUNTIME = new Set<WorkflowNodeType>([
    WorkflowNodeType.IfStatement,
    WorkflowNodeType.SwitchStatement,
    WorkflowNodeType.SwitchCase
]);
const rootSkip = (node: WorkflowNode): boolean =>
    WORKFLOW_NODE_PHASE[node.type] === 'runtime' && !PLANNING_EVALUATED_RUNTIME.has(node.type);

// Mirrors the nested skip-filter: defer ALL runtime nodes (incl. control-flow).
const nestedSkip = (node: WorkflowNode): boolean => !isPlanningNodeType(node.type);

const node = (id: string, type: WorkflowNodeType): WorkflowNode => ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: {}
});

interface RecordingExecutor {
    executor: WorkflowNodeExecutor;
    executedOrder: string[];
}

const makeRecordingExecutor = (options: {
    skipNodeIds?: Set<string>;
    foreachItems?: WorkflowNodeOutput[];
} = {}): RecordingExecutor => {
    const executedOrder: string[] = [];
    const executor = {
        executeNode: async (target: WorkflowNode): Promise<WorkflowNodeExecutionResult> => {
            if (options.skipNodeIds?.has(target.id)) {
                return { node: target, status: 'skipped', reason: `no handler for ${target.id}` };
            }

            executedOrder.push(target.id);
            const output: WorkflowNodeOutput = target.type === WorkflowNodeType.ForEach
                ? { items: options.foreachItems ?? [] }
                : { value: target.id };

            return { node: target, status: 'executed', output };
        }
    } as unknown as WorkflowNodeExecutor;

    return { executor, executedOrder };
};

test('executes planning-phase nodes in topological order and skip-filters deferred runtime nodes', async () => {
    const nodes = [
        node('modifier-1', WorkflowNodeType.Modifier),
        node('arguments-1', WorkflowNodeType.Arguments),
        node('context-1', WorkflowNodeType.Context),
        node('entrypoint-1', WorkflowNodeType.Entrypoint),
        node('exposure-1', WorkflowNodeType.Exposure)
    ];
    const { executor, executedOrder } = makeRecordingExecutor();

    const outcome = await new WorkflowPlanner(executor).plan({
        nodes,
        context: CONTEXT,
        shouldSkipNode: rootSkip
    });

    assert.deepEqual(executedOrder, ['modifier-1', 'arguments-1', 'context-1']);
    assert.deepEqual(outcome.executed.map((result) => result.node.id), ['modifier-1', 'arguments-1', 'context-1']);
    assert.equal(outcome.contextNodeId, 'context-1');
    assert.equal(outcome.forEach, undefined);
    assert.equal(outcome.haltedEarly, false);
});

test('stops traversal after the ForEach node and exposes its items', async () => {
    const nodes = [
        node('modifier-1', WorkflowNodeType.Modifier),
        node('arguments-1', WorkflowNodeType.Arguments),
        node('context-1', WorkflowNodeType.Context),
        node('foreach-1', WorkflowNodeType.ForEach),
        node('entrypoint-1', WorkflowNodeType.Entrypoint),
        node('exposure-1', WorkflowNodeType.Exposure)
    ];
    const items: WorkflowNodeOutput[] = [{ frame: 0 }, { frame: 1 }];
    const { executor, executedOrder } = makeRecordingExecutor({ foreachItems: items });

    const outcome = await new WorkflowPlanner(executor).plan({
        nodes,
        context: CONTEXT,
        shouldSkipNode: rootSkip
    });

    // Nodes after ForEach are never executed (traversal stopped).
    assert.deepEqual(executedOrder, ['modifier-1', 'arguments-1', 'context-1', 'foreach-1']);
    assert.deepEqual(
        outcome.executed.map((result) => result.node.id),
        ['modifier-1', 'arguments-1', 'context-1', 'foreach-1']
    );
    assert.ok(outcome.forEach);
    assert.equal(outcome.forEach!.node.id, 'foreach-1');
    assert.deepEqual(outcome.forEach!.items, items);
    assert.equal(outcome.haltedEarly, false);
});

test('onForEach returning true requests an early halt', async () => {
    const nodes = [
        node('context-1', WorkflowNodeType.Context),
        node('foreach-1', WorkflowNodeType.ForEach),
        node('entrypoint-1', WorkflowNodeType.Entrypoint)
    ];
    const { executor, executedOrder } = makeRecordingExecutor({ foreachItems: [] });
    let observedItems: WorkflowNodeOutput[] | undefined;

    const outcome = await new WorkflowPlanner(executor).plan({
        nodes,
        context: CONTEXT,
        shouldSkipNode: rootSkip,
        hooks: {
            onForEach: ({ items }) => {
                observedItems = items;
                return items.length === 0;
            }
        }
    });

    assert.equal(outcome.haltedEarly, true);
    assert.deepEqual(observedItems, []);
    // Still stops at ForEach regardless of the halt request.
    assert.deepEqual(executedOrder, ['context-1', 'foreach-1']);
});

test('afterNodeExecuted may replace output; skip-filter is silent while executor-skip fires afterNodeSkipped', async () => {
    const nodes = [
        node('modifier-1', WorkflowNodeType.Modifier),
        node('arguments-1', WorkflowNodeType.Arguments),
        node('context-1', WorkflowNodeType.Context),
        node('entrypoint-1', WorkflowNodeType.Entrypoint)
    ];
    // arguments-1 has "no handler" -> executor-skip; entrypoint-1 is skip-filtered.
    const { executor, executedOrder } = makeRecordingExecutor({ skipNodeIds: new Set(['arguments-1']) });
    const skippedEvents: Array<{ id: string; reason?: string }> = [];

    const outcome = await new WorkflowPlanner(executor).plan({
        nodes,
        context: CONTEXT,
        shouldSkipNode: rootSkip,
        hooks: {
            afterNodeExecuted: ({ node: executedNode, output }) =>
                executedNode.type === WorkflowNodeType.Modifier
                    ? { replaced: executedNode.id }
                    : output,
            afterNodeSkipped: ({ node: skippedNode, reason }) => {
                skippedEvents.push({ id: skippedNode.id, reason });
            }
        }
    });

    // Only the executor-skipped node fires afterNodeSkipped; the skip-filtered
    // runtime node (entrypoint-1) is silent and never executed.
    assert.deepEqual(skippedEvents.map((event) => event.id), ['arguments-1']);
    assert.match(skippedEvents[0]!.reason ?? '', /no handler/);
    assert.deepEqual(executedOrder, ['modifier-1', 'context-1']);

    const modifierResult = outcome.executed.find((result) => result.node.id === 'modifier-1');
    assert.deepEqual(modifierResult!.output, { replaced: 'modifier-1' });
});

test('skip-filter governs control-flow: executed under root semantics, deferred under nested semantics', async () => {
    const nodes = [
        node('modifier-1', WorkflowNodeType.Modifier),
        node('context-1', WorkflowNodeType.Context),
        node('if-1', WorkflowNodeType.IfStatement),
        node('entrypoint-1', WorkflowNodeType.Entrypoint)
    ];

    const root = makeRecordingExecutor();
    await new WorkflowPlanner(root.executor).plan({ nodes, context: CONTEXT, shouldSkipNode: rootSkip });
    // Root EVALUATES control-flow during planning; entrypoint stays deferred.
    assert.deepEqual(root.executedOrder, ['modifier-1', 'context-1', 'if-1']);

    const nested = makeRecordingExecutor();
    await new WorkflowPlanner(nested.executor).plan({ nodes, context: CONTEXT, shouldSkipNode: nestedSkip });
    // Nested defers control-flow (and entrypoint) to the runtime pass.
    assert.deepEqual(nested.executedOrder, ['modifier-1', 'context-1']);
});
