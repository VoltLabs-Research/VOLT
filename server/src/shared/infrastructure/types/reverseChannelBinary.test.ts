import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BINARY_ENVELOPE_HEADER_BYTES,
    EnvelopeKind,
    decodeEnvelope,
    decodeJsonEnvelope,
    encodeEnvelope,
    encodeJsonEnvelope,
    toUint8Array
} from './reverseChannelBinary';

test('reverseChannelBinary: encode/decode roundtrip', () => {
    const payload = new Uint8Array([1, 2, 3, 250, 251, 252]);
    const encoded = encodeEnvelope(7, EnvelopeKind.StreamChunk, payload);
    const decoded = decodeEnvelope(encoded);
    assert.equal(decoded.opId, 7);
    assert.equal(decoded.kind, EnvelopeKind.StreamChunk);
    assert.deepEqual(Array.from(decoded.payload), Array.from(payload));
    assert.equal(encoded.byteLength - payload.byteLength, BINARY_ENVELOPE_HEADER_BYTES);
});

test('reverseChannelBinary: rejects oversized opId / kind', () => {
    assert.throws(() => encodeEnvelope(0x1_0000_0000, EnvelopeKind.Ack, new Uint8Array()), RangeError);
    assert.throws(() => encodeEnvelope(0, 0x1_0000 as EnvelopeKind, new Uint8Array()), RangeError);
});

test('reverseChannelBinary: JSON envelope roundtrip', () => {
    const value = { command: 'filter-preview', property: 'energy', operator: '>', value: 1.5 };
    const encoded = encodeJsonEnvelope(3, value);
    const decoded = decodeJsonEnvelope<typeof value>(encoded);
    assert.equal(decoded.opId, 3);
    assert.deepEqual(decoded.value, value);
});

test('reverseChannelBinary: toUint8Array coerces Buffer and ArrayBuffer', () => {
    const buffer = Buffer.from([9, 9, 9]);
    const bufferView = toUint8Array(buffer);
    assert.equal(bufferView.byteLength, 3);

    const arrayBuffer = new ArrayBuffer(4);
    const arrayView = toUint8Array(arrayBuffer);
    assert.equal(arrayView.byteLength, 4);

    const uint = new Uint8Array([1, 2]);
    assert.equal(toUint8Array(uint), uint);
});

test('reverseChannelBinary: compatible with daemon envelope layout', () => {
    const payload = new Uint8Array([42, 43, 44]);
    const encoded = encodeEnvelope(0x11223344, EnvelopeKind.CommandBinary, payload);
    const view = new DataView(encoded.buffer, encoded.byteOffset);
    assert.equal(view.getUint32(0, true), 0x11223344);
    assert.equal(view.getUint16(4, true), EnvelopeKind.CommandBinary);
    assert.equal(view.getUint32(6, true), payload.byteLength);
    assert.deepEqual(Array.from(encoded.slice(BINARY_ENVELOPE_HEADER_BYTES)), Array.from(payload));
});
