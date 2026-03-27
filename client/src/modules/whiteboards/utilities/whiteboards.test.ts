import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeWhiteboardElements } from './whiteboards';

test('mergeWhiteboardElements keeps fileId updates when version metadata is unchanged', () => {
    const merged = mergeWhiteboardElements(
        [{ id: 'image-1', type: 'image', version: 1, updated: 10 }],
        [{ id: 'image-1', type: 'image', version: 1, updated: 10, fileId: 'asset-1' }]
    );

    assert.equal(merged[0]?.fileId, 'asset-1');
});
