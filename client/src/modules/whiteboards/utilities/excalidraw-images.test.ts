import assert from 'node:assert/strict';
import test from 'node:test';

import {
    extractWhiteboardImageFiles,
    isSupportedWhiteboardImageFile,
    scaleImageDimensionsToViewport
} from './whiteboard-image-files';

test('isSupportedWhiteboardImageFile accepts image mime types', () => {
    assert.equal(isSupportedWhiteboardImageFile(new File(['content'], 'image.png', { type: 'image/png' })), true);
    assert.equal(isSupportedWhiteboardImageFile(new File(['content'], 'notes.txt', { type: 'text/plain' })), false);
});

test('extractWhiteboardImageFiles keeps only image files', () => {
    const files = extractWhiteboardImageFiles([
        new File(['png'], 'figure.png', { type: 'image/png' }),
        new File(['text'], 'notes.txt', { type: 'text/plain' }),
        new File(['jpeg'], 'plot.jpg', { type: 'image/jpeg' })
    ]);

    assert.deepEqual(files.map((file) => file.name), ['figure.png', 'plot.jpg']);
});

test('scaleImageDimensionsToViewport scales oversized images to fit the viewport budget', () => {
    const dimensions = scaleImageDimensionsToViewport(
        { width: 4000, height: 2000 },
        { width: 1000, height: 800 }
    );

    assert.deepEqual(dimensions, {
        width: 650,
        height: 325
    });
});

test('scaleImageDimensionsToViewport keeps smaller images at their natural size', () => {
    const dimensions = scaleImageDimensionsToViewport(
        { width: 320, height: 180 },
        { width: 1200, height: 900 }
    );

    assert.deepEqual(dimensions, {
        width: 320,
        height: 180
    });
});
