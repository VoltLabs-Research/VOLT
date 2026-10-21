// Binary reverse-channel frames carry a little-endian header — u32 operation id, u16 kind,
// u32 payload length — followed by the payload. Stream chunks are the only kind in use.
const HEADER_BYTES = 10;
const STREAM_CHUNK_KIND = 3;

// Binary values reach either side as raw bytes or, after a JSON hop, as the shape
// Buffer#toJSON produces; toBytes also accepts the indexed objects socket.io can emit.
export type BinaryChunk = ArrayBuffer | ArrayBufferView | { type: 'Buffer'; data: number[] };

const readByte = (value: object, index: number): number => {
    const byte = (value as Record<string, unknown>)[String(index)];
    if (typeof byte !== 'number') {
        throw new TypeError('binary-envelope: buffer object contains a non-number byte');
    }
    return byte;
};

export const toBytes = (value: unknown): Uint8Array => {
    if (value instanceof Uint8Array) {
        return value;
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }

    if (Array.isArray(value)) {
        return Uint8Array.from(value);
    }

    if (value && typeof value === 'object') {
        const { data, length } = value as { data?: unknown; length?: unknown };
        if (Array.isArray(data)) {
            return Uint8Array.from(data);
        }

        const byteCount = typeof length === 'number' && Number.isInteger(length) && length >= 0
            ? length
            : Object.keys(value).filter((key) => /^(0|[1-9]\d*)$/.test(key)).length;
        if (byteCount > 0 || length === 0) {
            const bytes = new Uint8Array(byteCount);
            for (let index = 0; index < byteCount; index += 1) {
                bytes[index] = readByte(value, index);
            }
            return bytes;
        }
    }

    throw new TypeError('binary-envelope: expected binary chunk');
};

export const encodeStreamChunk = (payload: Uint8Array): Uint8Array => {
    const frame = new Uint8Array(HEADER_BYTES + payload.byteLength);
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    view.setUint32(0, 0, true);
    view.setUint16(4, STREAM_CHUNK_KIND, true);
    view.setUint32(6, payload.byteLength, true);
    frame.set(payload, HEADER_BYTES);
    return frame;
};

export const decodeStreamChunk = (chunk: unknown): Uint8Array => {
    const frame = toBytes(chunk);
    if (frame.byteLength < HEADER_BYTES) {
        throw new RangeError(`binary-envelope: buffer too short (${frame.byteLength} < ${HEADER_BYTES})`);
    }

    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const kind = view.getUint16(4, true);
    if (kind !== STREAM_CHUNK_KIND) {
        throw new Error(`binary-envelope: unexpected envelope kind ${kind}`);
    }

    const payloadLength = view.getUint32(6, true);
    if (frame.byteLength < HEADER_BYTES + payloadLength) {
        throw new RangeError(`binary-envelope: truncated payload (have ${frame.byteLength}, need ${HEADER_BYTES + payloadLength})`);
    }

    return frame.subarray(HEADER_BYTES, HEADER_BYTES + payloadLength);
};
