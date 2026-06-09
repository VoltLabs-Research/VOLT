import test from 'node:test';
import assert from 'node:assert/strict';

import {
    WorkflowWalker,
    MAX_TRACE_STRING_LENGTH,
    readWorkflowTrace,
    WORKFLOW_TRACE_ERROR_CODE,
    type InlineWorkflowTraceNode,
    type WorkflowWalkerDelegate,
    type WorkflowWalkerPluginExecution
} from './WorkflowWalker';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type {
    WorkflowExecutionContext,
    WorkflowGraph,
    WorkflowNode,
    WorkflowNodeOutput
} from '@/modules/analysis/contracts/workflow.types';
import type {
    WorkflowNodeExecutionResult,
    WorkflowNodeExecutor
} from './WorkflowNodeExecutor';
import type { WorkflowScheduler } from './WorkflowScheduler';
import type { WorkflowSession } from './WorkflowSession';
import ApplicationError from '@/app/coordination/ApplicationError';

/**
 * Unit tests for the unified {@link WorkflowWalker}. They drive the walker with
 * fully faked collaborators (graph, scheduler, node executor, session, delegate)
 * so the traversal contract the root pass relies on — and that Task 5 will reuse
 * for the nested pass — is asserted in isolation:
 *  - children are visited in the scheduler's activation order,
 *  - the shared visited set prevents re-execution,
 *  - Export nodes short-circuit,
 *  - If/Switch/ForEach child activation is honored,
 *  - an always-on trace node is appended per visit, and
 *  - large `output` string fields are defensively truncated in the trace.
 */

const node = (id: string, type: WorkflowNodeType): WorkflowNode => ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: {}
});

interface FakeBehavior {
    skip?: boolean;
    reason?: string;
    throwError?: Error;
    output?: WorkflowNodeOutput;
}

interface HarnessOptions {
    nodes: WorkflowNode[];
    children?: Record<string, string[]>;
    behaviors?: Record<string, FakeBehavior>;
    /** Mirrors WorkflowScheduler.resolveChildNodeIds(node, output).activeNodeIds. */
    resolveActive?: (node: WorkflowNode, output: WorkflowNodeOutput, children: string[]) => string[];
    isNodeReady?: (nodeId: string) => boolean;
    delegate?: Partial<WorkflowWalkerDelegate>;
    pluginId?: string;
    visitedSeed?: string[];
}

interface Harness {
    walker: WorkflowWalker;
    executedOrder: string[];
    pluginOrder: string[];
    outputs: Map<string, WorkflowNodeOutput>;
    run(startIds: string[], basePath?: string[]): Promise<void>;
    trace(): InlineWorkflowTraceNode[];
    nodeTrace(nodeId: string): InlineWorkflowTraceNode | undefined;
}

const createHarness = (options: HarnessOptions): Harness => {
    const nodeMap = new Map(options.nodes.map((entry) => [entry.id, entry]));
    const children = options.children ?? {};
    const behaviors = options.behaviors ?? {};
    const executedOrder: string[] = [];
    const pluginOrder: string[] = [];
    const outputs = new Map<string, WorkflowNodeOutput>();

    const graph = {
        getNode: (id: string) => nodeMap.get(id) ?? null,
        getChildNodeIds: (id: string) => children[id] ?? []
    } as unknown as WorkflowGraph;

    const scheduler = {
        resolveChildNodeIds: (target: WorkflowNode, output: WorkflowNodeOutput) => ({
            activeNodeIds: options.resolveActive
                ? options.resolveActive(target, output, children[target.id] ?? [])
                : children[target.id] ?? [],
            inactiveNodeIds: []
        }),
        isNodeReady: (id: string) => (options.isNodeReady ? options.isNodeReady(id) : true)
    } as unknown as WorkflowScheduler;

    const nodeExecutor = {
        executeNode: async (target: WorkflowNode): Promise<WorkflowNodeExecutionResult> => {
            executedOrder.push(target.id);
            const behavior = behaviors[target.id];
            if (behavior?.throwError) {
                throw behavior.throwError;
            }
            if (behavior?.skip) {
                return { node: target, status: 'skipped', reason: behavior.reason };
            }
            return { node: target, status: 'executed', output: behavior?.output ?? {} };
        }
    } as unknown as WorkflowNodeExecutor;

    const session = {
        outputs,
        setOutput: (id: string, output: WorkflowNodeOutput) => {
            outputs.set(id, output);
            return output;
        }
    } as unknown as WorkflowSession;

    const delegate: WorkflowWalkerDelegate = {
        executePlugin: options.delegate?.executePlugin
            ?? (async (target): Promise<WorkflowWalkerPluginExecution> => {
                pluginOrder.push(target.id);
                return { output: { pluginId: target.id } };
            }),
        buildNodeContext: options.delegate?.buildNodeContext
            ?? (() => ({}) as WorkflowExecutionContext),
        resolveExportOutput: options.delegate?.resolveExportOutput
            ?? (() => ({
                processed: false,
                skipped: true,
                reason: 'Export nodes are processed from their linked exposure'
            })),
        reportNodeRunning: options.delegate?.reportNodeRunning,
        reportNodeCompleted: options.delegate?.reportNodeCompleted,
        reportNodeFailed: options.delegate?.reportNodeFailed
    };

    const visitedNodeIds = new Set<string>(options.visitedSeed ?? []);
    const walker = new WorkflowWalker({
        graph,
        session,
        scheduler,
        nodeExecutor,
        visitedNodeIds,
        delegate,
        pluginId: options.pluginId
    });

    return {
        walker,
        executedOrder,
        pluginOrder,
        outputs,
        run: (startIds, basePath) => walker.walkFrom(startIds.map((id) => nodeMap.get(id)!), basePath),
        trace: () => walker.getTrace(),
        nodeTrace: (nodeId) => walker.getTrace().find((entry) => entry.nodeId === nodeId)
    };
};

test('walks depth-first and appends one completed trace node per visit, in order', async () => {
    const harness = createHarness({
        nodes: [
            node('a', WorkflowNodeType.Entrypoint),
            node('b', WorkflowNodeType.Entrypoint),
            node('c', WorkflowNodeType.Exposure)
        ],
        children: { a: ['b'], b: ['c'] }
    });

    await harness.run(['a']);

    assert.deepEqual(harness.executedOrder, ['a', 'b', 'c']);
    const trace = harness.trace();
    assert.deepEqual(trace.map((entry) => entry.nodeId), ['a', 'b', 'c']);
    assert.ok(trace.every((entry) => entry.status === 'completed'));
    assert.deepEqual(trace.map((entry) => entry.traceId), ['trace_1', 'trace_2', 'trace_3']);
    assert.ok(trace.every((entry) => typeof entry.durationMs === 'number'));
});

test('visits children in the scheduler-returned activation order, not raw graph order', async () => {
    const harness = createHarness({
        nodes: ['a', 'c1', 'c2', 'c3'].map((id) => node(id, WorkflowNodeType.Entrypoint)),
        children: { a: ['c1', 'c2', 'c3'] },
        // The scheduler re-orders the active children; the walker must follow it.
        resolveActive: (target, _output, childIds) =>
            target.id === 'a' ? ['c3', 'c1', 'c2'] : childIds
    });

    await harness.run(['a']);

    assert.deepEqual(harness.executedOrder, ['a', 'c3', 'c1', 'c2']);
});

test('the shared visited guard prevents re-executing a node reachable by multiple parents', async () => {
    const harness = createHarness({
        nodes: ['a', 'b', 'c', 'd'].map((id) => node(id, WorkflowNodeType.Entrypoint)),
        children: { a: ['b', 'c'], b: ['d'], c: ['d'] }
    });

    await harness.run(['a']);

    assert.deepEqual(harness.executedOrder, ['a', 'b', 'd', 'c']);
    assert.equal(harness.executedOrder.filter((id) => id === 'd').length, 1);
    assert.equal(harness.trace().filter((entry) => entry.nodeId === 'd').length, 1);
});

test('honors a pre-seeded visited set (already-resolved nodes are not revisited)', async () => {
    const harness = createHarness({
        nodes: ['a', 'b'].map((id) => node(id, WorkflowNodeType.Entrypoint)),
        children: { a: ['b'] },
        visitedSeed: ['b']
    });

    await harness.run(['a']);

    assert.deepEqual(harness.executedOrder, ['a']);
    assert.deepEqual(harness.trace().map((entry) => entry.nodeId), ['a']);
});

test('does not visit a child the scheduler reports as not ready', async () => {
    const harness = createHarness({
        nodes: ['a', 'b', 'c'].map((id) => node(id, WorkflowNodeType.Entrypoint)),
        children: { a: ['b', 'c'] },
        isNodeReady: (id) => id !== 'c'
    });

    await harness.run(['a']);

    assert.deepEqual(harness.executedOrder, ['a', 'b']);
    assert.ok(!harness.trace().some((entry) => entry.nodeId === 'c'));
});

test('Export nodes persist the delegate output, emit a skipped trace, and never recurse', async () => {
    const exportOutput = { processed: false, skipped: true, reason: 'linked exposure handles it' };
    const harness = createHarness({
        nodes: [
            node('a', WorkflowNodeType.Entrypoint),
            node('x', WorkflowNodeType.Export),
            node('y', WorkflowNodeType.Entrypoint)
        ],
        children: { a: ['x'], x: ['y'] },
        delegate: { resolveExportOutput: () => exportOutput }
    });

    await harness.run(['a']);

    // The node executor is never invoked for the Export node and recursion stops.
    assert.deepEqual(harness.executedOrder, ['a']);
    assert.deepEqual(harness.outputs.get('x'), exportOutput);
    const exportTrace = harness.nodeTrace('x')!;
    assert.equal(exportTrace.status, 'skipped');
    assert.equal(exportTrace.reason, 'linked exposure handles it');
    assert.deepEqual(exportTrace.output, exportOutput);
    assert.ok(!harness.trace().some((entry) => entry.nodeId === 'y'));
});

test('Plugin nodes run through the delegate callback (not the node executor) and recurse', async () => {
    const harness = createHarness({
        nodes: [node('p', WorkflowNodeType.Plugin), node('c', WorkflowNodeType.Exposure)],
        children: { p: ['c'] }
    });

    await harness.run(['p']);

    assert.deepEqual(harness.pluginOrder, ['p']);
    assert.ok(!harness.executedOrder.includes('p'));
    assert.deepEqual(harness.executedOrder, ['c']);
    assert.deepEqual(harness.outputs.get('p'), { pluginId: 'p' });
    const pluginTrace = harness.nodeTrace('p')!;
    assert.equal(pluginTrace.status, 'completed');
    assert.deepEqual(pluginTrace.output, { pluginId: 'p' });
});

test('Plugin trace nodes carry the nested sub-trace returned by the delegate', async () => {
    const childTrace: InlineWorkflowTraceNode[] = [
        { traceId: 'nested_1', nodeId: 'inner', nodeType: 'entrypoint', status: 'completed', durationMs: 1 }
    ];
    const harness = createHarness({
        nodes: [node('p', WorkflowNodeType.Plugin)],
        delegate: {
            executePlugin: async () => ({ output: { pluginId: 'p' }, trace: childTrace })
        }
    });

    await harness.run(['p']);

    assert.deepEqual(harness.nodeTrace('p')!.children, childTrace);
});

test('If activation: only the selected branch child is visited', async () => {
    const harness = createHarness({
        nodes: [
            node('if', WorkflowNodeType.IfStatement),
            node('t', WorkflowNodeType.Entrypoint),
            node('f', WorkflowNodeType.Entrypoint)
        ],
        children: { if: ['t', 'f'] },
        behaviors: { if: { output: { branch: 'true' } } },
        resolveActive: (target, output, childIds) =>
            target.type === WorkflowNodeType.IfStatement
                ? [output.branch === 'true' ? childIds[0]! : childIds[1]!]
                : childIds
    });

    await harness.run(['if']);

    assert.deepEqual(harness.executedOrder, ['if', 't']);
    assert.ok(!harness.trace().some((entry) => entry.nodeId === 'f'));
});

test('Switch activation: only the matched case plus continue children are visited', async () => {
    const harness = createHarness({
        nodes: [
            node('sw', WorkflowNodeType.SwitchStatement),
            node('caseA', WorkflowNodeType.Entrypoint),
            node('caseB', WorkflowNodeType.Entrypoint),
            node('cont', WorkflowNodeType.Entrypoint)
        ],
        children: { sw: ['caseA', 'caseB', 'cont'] },
        behaviors: { sw: { output: { matchedCaseId: 'caseB' } } },
        resolveActive: (target, output, childIds) => {
            if (target.type !== WorkflowNodeType.SwitchStatement) {
                return childIds;
            }
            const matched = childIds.filter((id) => id === output.matchedCaseId);
            return [...matched, 'cont'];
        }
    });

    await harness.run(['sw']);

    assert.deepEqual(harness.executedOrder, ['sw', 'caseB', 'cont']);
    assert.ok(!harness.trace().some((entry) => entry.nodeId === 'caseA'));
});

test('ForEach activation: children run only when the ForEach yields items', async () => {
    const resolveActive = (target: WorkflowNode, output: WorkflowNodeOutput, childIds: string[]): string[] => {
        if (target.type !== WorkflowNodeType.ForEach) {
            return childIds;
        }
        return typeof output.count === 'number' && output.count > 0 ? childIds : [];
    };

    const withItems = createHarness({
        nodes: [node('fe', WorkflowNodeType.ForEach), node('body', WorkflowNodeType.Entrypoint)],
        children: { fe: ['body'] },
        behaviors: { fe: { output: { count: 2 } } },
        resolveActive
    });
    await withItems.run(['fe']);
    assert.deepEqual(withItems.executedOrder, ['fe', 'body']);

    const withoutItems = createHarness({
        nodes: [node('fe', WorkflowNodeType.ForEach), node('body', WorkflowNodeType.Entrypoint)],
        children: { fe: ['body'] },
        behaviors: { fe: { output: { count: 0 } } },
        resolveActive
    });
    await withoutItems.run(['fe']);
    assert.deepEqual(withoutItems.executedOrder, ['fe']);
    assert.ok(!withoutItems.trace().some((entry) => entry.nodeId === 'body'));
});

test('an executor-skipped node emits a skipped trace and does not recurse', async () => {
    const harness = createHarness({
        nodes: [node('a', WorkflowNodeType.Entrypoint), node('b', WorkflowNodeType.Entrypoint)],
        children: { a: ['b'] },
        behaviors: { a: { skip: true, reason: 'no handler registered' } }
    });

    await harness.run(['a']);

    assert.deepEqual(harness.executedOrder, ['a']);
    const skippedTrace = harness.nodeTrace('a')!;
    assert.equal(skippedTrace.status, 'skipped');
    assert.equal(skippedTrace.reason, 'no handler registered');
    assert.ok(!harness.trace().some((entry) => entry.nodeId === 'b'));
});

test('a node returning skipped output is persisted, traced as skipped, and still recurses', async () => {
    const harness = createHarness({
        nodes: [node('ex', WorkflowNodeType.Exposure), node('exp', WorkflowNodeType.Export)],
        children: { ex: ['exp'] },
        behaviors: { ex: { output: { processed: false, skipped: true, reason: 'no results file' } } }
    });

    await harness.run(['ex']);

    assert.deepEqual(harness.outputs.get('ex'), { processed: false, skipped: true, reason: 'no results file' });
    const exposureTrace = harness.nodeTrace('ex')!;
    assert.equal(exposureTrace.status, 'skipped');
    assert.equal(exposureTrace.reason, 'no results file');
    // Root behavior is preserved: a skipped-output node still recurses into children.
    assert.ok(harness.trace().some((entry) => entry.nodeId === 'exp'));
});

test('invokes the node lifecycle reporters around the executor path, in order', async () => {
    const reports: string[] = [];
    const harness = createHarness({
        nodes: [node('a', WorkflowNodeType.Entrypoint)],
        delegate: {
            reportNodeRunning: (target) => { reports.push(`running:${target.id}`); },
            reportNodeCompleted: (target) => { reports.push(`completed:${target.id}`); }
        }
    });

    await harness.run(['a']);

    assert.deepEqual(reports, ['running:a', 'completed:a']);
});

test('a failing node reports failure, appends an error trace, and throws a trace-carrying failure', async () => {
    const reports: string[] = [];
    const boom = new Error('kaboom');
    const harness = createHarness({
        nodes: [node('a', WorkflowNodeType.Entrypoint), node('b', WorkflowNodeType.Entrypoint)],
        children: { a: ['b'] },
        behaviors: { b: { throwError: boom } },
        delegate: {
            reportNodeRunning: (target) => { reports.push(`running:${target.id}`); },
            reportNodeCompleted: (target) => { reports.push(`completed:${target.id}`); },
            reportNodeFailed: (target, error) => {
                reports.push(`failed:${target.id}:${(error as Error).message}`);
            }
        }
    });

    await assert.rejects(
        () => harness.run(['a']),
        (error: unknown) => {
            assert.ok(error instanceof ApplicationError);
            assert.equal(error.code, WORKFLOW_TRACE_ERROR_CODE);
            // The original failure message is preserved for unchanged error propagation.
            assert.equal(error.message, 'kaboom');
            const trace = readWorkflowTrace(error);
            assert.ok(trace, 'expected the failure to carry the partial trace');
            assert.ok(trace!.some((entry) => entry.nodeId === 'b' && entry.status === 'error' && entry.error === 'kaboom'));
            return true;
        }
    );

    // running:a, completed:a (a succeeds), running:b, failed:b (b throws).
    assert.deepEqual(reports, ['running:a', 'completed:a', 'running:b', 'failed:b:kaboom']);
});

test('truncates noisy and oversized string fields in the trace output but leaves the persisted output intact', async () => {
    const bigStdout = 'S'.repeat(MAX_TRACE_STRING_LENGTH + 5000);
    const fullOutput: WorkflowNodeOutput = {
        stdout: bigStdout,
        stderr: 'short-stderr',
        pluginResult: 'P'.repeat(MAX_TRACE_STRING_LENGTH + 10),
        summary: 'G'.repeat(MAX_TRACE_STRING_LENGTH + 100),
        nested: { stdout: 'N'.repeat(MAX_TRACE_STRING_LENGTH + 1) },
        small: 'ok',
        count: 3
    };
    const harness = createHarness({
        nodes: [node('a', WorkflowNodeType.Entrypoint)],
        behaviors: { a: { output: structuredClone(fullOutput) } }
    });

    await harness.run(['a']);

    const traceOutput = harness.trace()[0]!.output as Record<string, unknown>;

    // The noisy `stdout` field is truncated to the cap + a note.
    const truncatedStdout = traceOutput.stdout as string;
    assert.ok(truncatedStdout.length < bigStdout.length);
    assert.ok(truncatedStdout.startsWith('S'.repeat(MAX_TRACE_STRING_LENGTH)));
    assert.match(truncatedStdout, /\[truncated 5000 of \d+ chars\]/);

    // Other noisy fields and any oversized generic string are truncated too,
    // including nested ones.
    assert.match(traceOutput.pluginResult as string, /\[truncated 10 of \d+ chars\]/);
    assert.match(traceOutput.summary as string, /\[truncated 100 of \d+ chars\]/);
    assert.match((traceOutput.nested as Record<string, string>).stdout, /\[truncated 1 of \d+ chars\]/);

    // Short strings and non-strings are left untouched.
    assert.equal(traceOutput.stderr, 'short-stderr');
    assert.equal(traceOutput.small, 'ok');
    assert.equal(traceOutput.count, 3);

    // The persisted node output is never mutated by trace sanitization.
    const persisted = harness.outputs.get('a') as Record<string, unknown>;
    assert.equal((persisted.stdout as string).length, bigStdout.length);
    assert.equal(persisted.stdout, bigStdout);
    assert.equal((persisted.nested as Record<string, string>).stdout.length, MAX_TRACE_STRING_LENGTH + 1);
});

/**
 * Nested-usage cases. Task 5 routes the NESTED pluginReference pass through this
 * same walker: `executeNestedPluginWorkflow` builds a walker whose plugin
 * callback recurses into `executePluginNode` (which spins up another walker),
 * seeds the walk with the parent `executionPath` (basePath), and — because the
 * nested delegate persists nothing for Export nodes — relies on the walker
 * emitting no trace node for an Export whose delegate returns `undefined`.
 */

test('nested usage: a plugin callback drives a child walker and surfaces its sub-trace as children', async () => {
    // Inner (nested) graph: an entrypoint feeding an exposure — the shape the
    // nested runtime pass walks.
    const inner = createHarness({
        nodes: [node('inner-entry', WorkflowNodeType.Entrypoint), node('inner-expo', WorkflowNodeType.Exposure)],
        children: { 'inner-entry': ['inner-expo'] }
    });

    // Outer graph: a single Plugin node whose callback runs the inner walker,
    // exactly how executeNestedPluginWorkflow reuses the walker from inside the
    // plugin execution path (walker -> plugin callback -> nested walker).
    const outer = createHarness({
        nodes: [node('outer-plugin', WorkflowNodeType.Plugin)],
        delegate: {
            executePlugin: async (): Promise<WorkflowWalkerPluginExecution> => {
                await inner.run(['inner-entry']);
                return { output: { pluginId: 'outer-plugin' }, trace: inner.trace() };
            }
        }
    });

    await outer.run(['outer-plugin']);

    // The inner walker actually traversed the nested graph (recursion happened).
    assert.deepEqual(inner.executedOrder, ['inner-entry', 'inner-expo']);
    // The outer Plugin trace node carries the inner walker's trace as children.
    const pluginTrace = outer.nodeTrace('outer-plugin')!;
    assert.equal(pluginTrace.status, 'completed');
    assert.deepEqual(pluginTrace.children, inner.trace());
    assert.deepEqual(pluginTrace.children!.map((child) => child.nodeId), ['inner-entry', 'inner-expo']);
});

test('nested usage: walkFrom basePath prefixes the execution path handed to the delegate', async () => {
    const seenPaths: Record<string, string[]> = {};
    const harness = createHarness({
        nodes: [node('a', WorkflowNodeType.Entrypoint), node('b', WorkflowNodeType.Entrypoint)],
        children: { a: ['b'] },
        delegate: {
            buildNodeContext: (target, executionPath) => {
                seenPaths[target.id] = [...executionPath];
                return {} as WorkflowExecutionContext;
            }
        }
    });

    // The nested pass seeds the walk with the parent plugin's executionPath.
    await harness.run(['a'], ['root-plugin', 'parent']);

    assert.deepEqual(seenPaths.a, ['root-plugin', 'parent', 'a']);
    assert.deepEqual(seenPaths.b, ['root-plugin', 'parent', 'a', 'b']);
});

test('root behavior preserved: without a basePath the execution path is just the node id chain', async () => {
    const seenPaths: Record<string, string[]> = {};
    const harness = createHarness({
        nodes: [node('a', WorkflowNodeType.Entrypoint), node('b', WorkflowNodeType.Entrypoint)],
        children: { a: ['b'] },
        delegate: {
            buildNodeContext: (target, executionPath) => {
                seenPaths[target.id] = [...executionPath];
                return {} as WorkflowExecutionContext;
            }
        }
    });

    await harness.run(['a']);

    assert.deepEqual(seenPaths.a, ['a']);
    assert.deepEqual(seenPaths.b, ['a', 'b']);
});

test('nested usage: an Export node whose delegate returns no output persists nothing, emits no trace, and never recurses', async () => {
    const harness = createHarness({
        nodes: [
            node('a', WorkflowNodeType.Entrypoint),
            node('x', WorkflowNodeType.Export),
            node('y', WorkflowNodeType.Entrypoint)
        ],
        children: { a: ['x'], x: ['y'] },
        // Nested delegates persist nothing for Export nodes.
        delegate: { resolveExportOutput: () => undefined }
    });

    await harness.run(['a']);

    // Only the entrypoint runs; the Export persists nothing, contributes no
    // trace node, and recursion stops there (so 'y' never runs) — matching the
    // previous nested traversal exactly.
    assert.deepEqual(harness.executedOrder, ['a']);
    assert.equal(harness.outputs.has('x'), false);
    assert.equal(harness.nodeTrace('x'), undefined);
    assert.ok(!harness.trace().some((entry) => entry.nodeId === 'y'));
    assert.deepEqual(harness.trace().map((entry) => entry.nodeId), ['a']);
});
