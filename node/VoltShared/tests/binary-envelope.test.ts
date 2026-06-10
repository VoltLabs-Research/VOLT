import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    BINARY_ENVELOPE_HEADER_BYTES,
    EnvelopeKind,
    decodeEnvelope,
    encodeEnvelope,
    toUint8Array
} from '../src/binary-envelope';

describe('binary-envelope', () => {
    it('round-trips opId, kind and payload', () => {
        const payload = new Uint8Array([1, 2, 3, 4, 5]);
        const encoded = encodeEnvelope(42, EnvelopeKind.StreamChunk, payload);

        assert.equal(encoded.byteLength, BINARY_ENVELOPE_HEADER_BYTES + payload.byteLength);

        const decoded = decodeEnvelope(encoded);
        assert.equal(decoded.opId, 42);
        assert.equal(decoded.kind, EnvelopeKind.StreamChunk);
        assert.deepEqual([...decoded.payload], [1, 2, 3, 4, 5]);
    });

    it('handles empty payloads', () => {
        const encoded = encodeEnvelope(0, EnvelopeKind.Ack, new Uint8Array(0));
        const decoded = decodeEnvelope(encoded);
        assert.equal(decoded.opId, 0);
        assert.equal(decoded.payload.byteLength, 0);
    });

    it('rejects out-of-range opId and kind', () => {
        assert.throws(() => encodeEnvelope(-1, EnvelopeKind.Ack, new Uint8Array(0)), RangeError);
        assert.throws(() => encodeEnvelope(2 ** 32, EnvelopeKind.Ack, new Uint8Array(0)), RangeError);
        assert.throws(() => encodeEnvelope(0, 70000 as EnvelopeKind, new Uint8Array(0)), RangeError);
    });

    it('rejects buffers shorter than the header', () => {
        assert.throws(() => decodeEnvelope(new Uint8Array(4)), RangeError);
    });

    it('rejects a truncated payload', () => {
        const encoded = encodeEnvelope(1, EnvelopeKind.CommandBinary, new Uint8Array([9, 9, 9]));
        assert.throws(() => decodeEnvelope(encoded.subarray(0, encoded.byteLength - 1)), RangeError);
    });

    it('toUint8Array accepts arrays, ArrayBuffers and serialized buffer objects', () => {
        assert.deepEqual([...toUint8Array([1, 2, 3])], [1, 2, 3]);
        assert.deepEqual([...toUint8Array(new Uint8Array([4, 5]).buffer)], [4, 5]);
        assert.deepEqual([...toUint8Array({ type: 'Buffer', data: [6, 7] })], [6, 7]);
        assert.deepEqual([...toUint8Array({ 0: 8, 1: 9, length: 2 })], [8, 9]);
    });

    it('toUint8Array rejects non-binary input', () => {
        assert.throws(() => toUint8Array('not binary'), TypeError);
    });
});
