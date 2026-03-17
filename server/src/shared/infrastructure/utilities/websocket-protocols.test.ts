import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildWebSocketProtocolList,
    readWebSocketProtocols
} from './websocket-protocols';

test('readWebSocketProtocols splits comma-separated websocket protocol headers', () => {
    assert.deepEqual(readWebSocketProtocols('v1.kernel.websocket.jupyter.org, graphql-transport-ws'), [
        'v1.kernel.websocket.jupyter.org',
        'graphql-transport-ws'
    ]);
});

test('readWebSocketProtocols merges repeated header values and ignores blanks', () => {
    assert.deepEqual(readWebSocketProtocols([
        'v1.kernel.websocket.jupyter.org',
        ' , graphql-ws , v1.kernel.websocket.jupyter.org '
    ]), [
        'v1.kernel.websocket.jupyter.org',
        'graphql-ws'
    ]);
});

test('buildWebSocketProtocolList returns undefined when no protocol was requested', () => {
    assert.equal(buildWebSocketProtocolList(undefined), undefined);
    assert.equal(buildWebSocketProtocolList(' , '), undefined);
});
