/**
 * Framing for the chunk-carrying reverse-channel messages.
 *
 * Wire layout, little-endian: [u32 opId][u16 kind][u32 payloadLen][payload].
 * Both ends only ever exchange stream chunks, so `opId` is pinned to 0 and
 * `kind` to STREAM_CHUNK_KIND; the header keeps its shape for compatibility.
 */
const BINARY_ENVELOPE_HEADER_BYTES = 10;
const STREAM_CHUNK_KIND = 3;

export const encodeStreamChunk = (payload: Uint8Array): Uint8Array => {
    const out = new Uint8Array(BINARY_ENVELOPE_HEADER_BYTES + payload.byteLength);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setUint32(0, 0, true);
    view.setUint16(4, STREAM_CHUNK_KIND, true);
    view.setUint32(6, payload.byteLength, true);
    if (payload.byteLength > 0) {
        out.set(payload, BINARY_ENVELOPE_HEADER_BYTES);
    }
    return out;
};

/**
 * A Node `Buffer` that has been through JSON serialization. The reverse channel
 * emits chunks this way, so it is the shape inbound frames actually arrive in.
 */
export interface SerializedBuffer {
    type: 'Buffer';
    data: number[];
}

/** Every representation an inbound chunk can legitimately have on the wire. */
export type InboundChunk = ArrayBuffer | ArrayBufferView | SerializedBuffer;

/**
 * Normalizes any of those representations to a zero-copy view where possible.
 * Every value that reached us over the reverse channel goes through here.
 */
export const toBytes = (frame: InboundChunk): Uint8Array => {
    if (ArrayBuffer.isView(frame)) {
        return new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength);
    }

    if (frame instanceof ArrayBuffer) {
        return new Uint8Array(frame);
    }

    return Uint8Array.from(frame.data);
};

/**
 * Both length checks are load-bearing: the frame is usually a view into a pooled
 * Buffer, so a bogus payloadLen would otherwise read adjacent pool memory
 * instead of throwing.
 */
export const decodeStreamChunk = (frame: InboundChunk): Buffer => {
    const bytes = toBytes(frame);

    if (bytes.byteLength < BINARY_ENVELOPE_HEADER_BYTES) {
        throw new RangeError(`binary-envelope: buffer too short (${bytes.byteLength} < ${BINARY_ENVELOPE_HEADER_BYTES})`);
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const kind = view.getUint16(4, true);
    if (kind !== STREAM_CHUNK_KIND) {
        throw new Error(`binary-envelope: unexpected envelope kind ${kind}`);
    }

    const payloadLen = view.getUint32(6, true);
    const expectedLen = BINARY_ENVELOPE_HEADER_BYTES + payloadLen;
    if (bytes.byteLength < expectedLen) {
        throw new RangeError(`binary-envelope: truncated payload (have ${bytes.byteLength}, need ${expectedLen})`);
    }

    return Buffer.from(bytes.buffer, bytes.byteOffset + BINARY_ENVELOPE_HEADER_BYTES, payloadLen);
};
