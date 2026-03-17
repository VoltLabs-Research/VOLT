import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveInlinePluginExecutionOrder } from './AnalysisWorker';

test('resolveInlinePluginExecutionOrder supports top-level context chain', () => {
    const nodes = [
        { id: 'modifier', type: 'modifier', position: { x: 0, y: 0 }, data: {} },
        { id: 'arguments', type: 'arguments', position: { x: 0, y: 0 }, data: {} },
        { id: 'context', type: 'context', position: { x: 0, y: 0 }, data: {} },
        { id: 'plugin-a', type: 'plugin-node', position: { x: 0, y: 0 }, data: { pluginNode: { pluginId: 'plugin-a' } } },
        { id: 'plugin-b', type: 'plugin-node', position: { x: 0, y: 0 }, data: { pluginNode: { pluginId: 'plugin-b' } } },
        { id: 'entrypoint', type: 'entrypoint', position: { x: 0, y: 0 }, data: {} }
    ];
    const edges = [
        { id: 'e1', source: 'modifier', target: 'arguments' },
        { id: 'e2', source: 'arguments', target: 'context' },
        { id: 'e3', source: 'context', target: 'plugin-a' },
        { id: 'e4', source: 'plugin-a', target: 'plugin-b' },
        { id: 'e5', source: 'plugin-b', target: 'entrypoint' }
    ];

    const order = resolveInlinePluginExecutionOrder({ nodes, edges });

    assert.deepEqual(order.map((node) => node.id), ['plugin-a', 'plugin-b']);
});

test('resolveInlinePluginExecutionOrder supports top-level forEach chain', () => {
    const nodes = [
        { id: 'modifier', type: 'modifier', position: { x: 0, y: 0 }, data: {} },
        { id: 'arguments', type: 'arguments', position: { x: 0, y: 0 }, data: {} },
        { id: 'context', type: 'context', position: { x: 0, y: 0 }, data: {} },
        { id: 'foreach', type: 'forEach', position: { x: 0, y: 0 }, data: {} },
        { id: 'plugin-a', type: 'plugin-node', position: { x: 0, y: 0 }, data: { pluginNode: { pluginId: 'plugin-a' } } },
        { id: 'entrypoint', type: 'entrypoint', position: { x: 0, y: 0 }, data: {} }
    ];
    const edges = [
        { id: 'e1', source: 'modifier', target: 'arguments' },
        { id: 'e2', source: 'arguments', target: 'context' },
        { id: 'e3', source: 'context', target: 'foreach' },
        { id: 'e4', source: 'foreach', target: 'plugin-a' },
        { id: 'e5', source: 'plugin-a', target: 'entrypoint' }
    ];

    const order = resolveInlinePluginExecutionOrder({ nodes, edges });

    assert.deepEqual(order.map((node) => node.id), ['plugin-a']);
});
