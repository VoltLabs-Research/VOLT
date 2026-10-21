import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { decodeStreamChunk, encodeStreamChunk, toBytes } from '../src/contracts/binaryEnvelope';

const payload = Uint8Array.from([1, 2, 3, 250]);

describe('binary envelope', () => {
    it('round-trips a stream chunk', () => {
        const frame = encodeStreamChunk(payload);
        assert.equal(frame.byteLength, 10 + payload.byteLength);
        assert.deepEqual(decodeStreamChunk(frame), payload);
    });

    it('decodes frames that went through a JSON hop', () => {
        const frame = Buffer.from(encodeStreamChunk(payload));
        assert.deepEqual(decodeStreamChunk(frame.toJSON()), payload);
        assert.deepEqual(decodeStreamChunk({ ...Array.from(frame) }), payload);
    });

    it('rejects truncated and foreign frames', () => {
        const frame = encodeStreamChunk(payload);
        assert.throws(() => decodeStreamChunk(frame.subarray(0, 12)), RangeError);
        const foreign = frame.slice();
        new DataView(foreign.buffer).setUint16(4, 1, true);
        assert.throws(() => decodeStreamChunk(foreign), /unexpected envelope kind 1/);
        assert.throws(() => toBytes('not bytes'), TypeError);
    });
});
