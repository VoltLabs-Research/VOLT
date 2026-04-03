import assert from 'node:assert/strict';
import test from 'node:test';

import { computeWhiteboardSceneDelta, mergeWhiteboardElements } from './whiteboards';

test('mergeWhiteboardElements keeps fileId updates when version metadata is unchanged', () => {
    const merged = mergeWhiteboardElements(
        [{ id: 'image-1', type: 'image', version: 1, updated: 10 }],
        [{ id: 'image-1', type: 'image', version: 1, updated: 10, fileId: 'asset-1' }]
    );

    assert.equal(merged[0]?.fileId, 'asset-1');
});

test('mergeWhiteboardElements preserves current order for partial deltas and applies explicit z-order updates', () => {
    const partialMerge = mergeWhiteboardElements(
        [
            { id: 'a', version: 1, updated: 10 },
            { id: 'b', version: 1, updated: 11 }
        ],
        [{ id: 'c', version: 1, updated: 12 }]
    );

    assert.deepEqual(partialMerge.map((element) => element.id), ['a', 'b', 'c']);

    const reorderedMerge = mergeWhiteboardElements(
        partialMerge,
        [],
        ['c', 'a', 'b']
    );

    assert.deepEqual(reorderedMerge.map((element) => element.id), ['c', 'a', 'b']);
});

test('computeWhiteboardSceneDelta emits only changed elements, app state fields, and order when needed', () => {
    const delta = computeWhiteboardSceneDelta(
        [
            { id: 'a', version: 1, updated: 10 },
            { id: 'b', version: 1, updated: 11 }
        ],
        [
            { id: 'b', version: 2, updated: 20 },
            { id: 'a', version: 1, updated: 10 },
            { id: 'c', version: 1, updated: 21 }
        ],
        { viewBackgroundColor: '#fff', gridSize: 8 },
        { viewBackgroundColor: '#000', gridSize: 8 }
    );

    assert.equal(delta.changed, true);
    assert.deepEqual(delta.elements.map((element) => element.id), ['b', 'c']);
    assert.deepEqual(delta.appState, { viewBackgroundColor: '#000' });
    assert.deepEqual(delta.elementOrder, ['b', 'a', 'c']);
});
