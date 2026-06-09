import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTraceLogSegments } from '@/modules/analysis/application/workflow/trace-log-segments';
import type { InlineWorkflowTraceNode } from '@/modules/analysis/application/workflow/WorkflowWalker';

const node = (overrides: Partial<InlineWorkflowTraceNode> & Pick<InlineWorkflowTraceNode, 'nodeId' | 'nodeType' | 'status'>): InlineWorkflowTraceNode => ({
    traceId: `trace_${overrides.nodeId}`,
    durationMs: 1,
    ...overrides
});

test('buildTraceLogSegments returns nothing for an empty trace', () => {
    assert.deepEqual(buildTraceLogSegments([], { success: true }), []);
});

test('buildTraceLogSegments emits a success/failure header', () => {
    const ok = buildTraceLogSegments([node({ nodeId: 'a', nodeType: 'entrypoint', status: 'completed' })], { success: true });
    const failed = buildTraceLogSegments([node({ nodeId: 'a', nodeType: 'entrypoint', status: 'completed' })], { success: false });

    assert.match(ok[0]!.text, /Execution trace \(success\)/);
    assert.match(failed[0]!.text, /Execution trace \(failure\)/);
});

test('buildTraceLogSegments renders a node line with frame-log metadata', () => {
    const segments = buildTraceLogSegments(
        [node({ nodeId: 'ep-1', nodeType: 'entrypoint', status: 'completed', label: 'Run binary', pluginId: 'plug-1', durationMs: 42 })],
        { success: true }
    );

    const line = segments.find((segment) => segment.nodeId === 'ep-1');
    assert.ok(line);
    assert.equal(line!.nodeType, 'entrypoint');
    assert.equal(line!.nodeLabel, 'Run binary');
    assert.equal(line!.pluginId, 'plug-1');
    assert.deepEqual(line!.executionPath, ['ep-1']);
    assert.match(line!.text, /entrypoint Run binary: ok \(42ms\)/);
});

test('buildTraceLogSegments captures hierarchy via executionPath and an error stream', () => {
    const segments = buildTraceLogSegments(
        [node({
            nodeId: 'plugin-1',
            nodeType: 'plugin-node',
            status: 'completed',
            children: [node({ nodeId: 'child-ep', nodeType: 'entrypoint', status: 'error', error: 'boom' })]
        })],
        { success: false }
    );

    const child = segments.find((segment) => segment.nodeId === 'child-ep');
    assert.ok(child);
    assert.deepEqual(child!.executionPath, ['plugin-1', 'child-ep']);
    assert.equal(child!.stream, 'stderr');
    assert.match(child!.text, /error.*— boom/);
});

test('buildTraceLogSegments includes a skip reason', () => {
    const segments = buildTraceLogSegments(
        [node({ nodeId: 'if-1', nodeType: 'if-statement', status: 'skipped', reason: 'branch not taken' })],
        { success: true }
    );

    const line = segments.find((segment) => segment.nodeId === 'if-1');
    assert.match(line!.text, /skipped.*— branch not taken/);
});

test('buildTraceLogSegments serializes node output (decision 2=b) into its own segment', () => {
    const segments = buildTraceLogSegments(
        [node({ nodeId: 'ep-1', nodeType: 'entrypoint', status: 'completed', output: { exitCode: 0, stdout: 'done' } })],
        { success: true }
    );

    const outputSegment = segments.find((segment) => segment.text.includes('↳ output:'));
    assert.ok(outputSegment, 'expected an output segment');
    assert.match(outputSegment!.text, /"exitCode":0/);
    assert.equal(outputSegment!.nodeId, 'ep-1');
});

test('buildTraceLogSegments omits the output segment when output is empty', () => {
    const segments = buildTraceLogSegments(
        [node({ nodeId: 'ctx-1', nodeType: 'context', status: 'completed', output: {} })],
        { success: true }
    );

    assert.equal(segments.some((segment) => segment.text.includes('↳ output:')), false);
});
