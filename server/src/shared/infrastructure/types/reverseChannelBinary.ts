/**
 * Server twin of ClusterDaemon/src/core/reverse-channel/contracts/binary-envelope.ts
 *
 * Kept as a small copy (no cross-project path alias) because the daemon and
 * server live in independent TypeScript projects. The two files MUST stay in
 * sync — any change to the envelope layout must be mirrored on both sides.
 *
 * Wire format (little-endian, fixed 10-byte header):
 *   [u32 opId][u16 kind][u32 payloadLen][...payload bytes...]
 */

export const BINARY_ENVELOPE_HEADER_BYTES = 10;

export enum EnvelopeKind {
    CommandJson = 1,
    CommandBinary = 2,
    StreamChunk = 3,
    Ack = 4,
    Error = 5
}

export interface DecodedEnvelope {
    opId: number;
    kind: EnvelopeKind;
    payload: Uint8Array;
}

interface SerializedBuffer {
    type?: unknown;
    data?: unknown;
    length?: unknown;
}

const assertUint32 = (value: number, field: string): void => {
    if (!Number.isInteger(value) || value < 0 || value > 0xFFFFFFFF) {
        throw new RangeError(`binary-envelope: ${field} must be a u32 integer in [0, 2^32), got ${value}`);
    }
};

const assertUint16 = (value: number, field: string): void => {
    if (!Number.isInteger(value) || value < 0 || value > 0xFFFF) {
        throw new RangeError(`binary-envelope: ${field} must be a u16 integer in [0, 2^16), got ${value}`);
    }
};

export const encodeEnvelope = (opId: number, kind: EnvelopeKind, payload: Uint8Array): Uint8Array => {
    assertUint32(opId, 'opId');
    assertUint16(kind, 'kind');
    assertUint32(payload.byteLength, 'payload.byteLength');

    const out = new Uint8Array(BINARY_ENVELOPE_HEADER_BYTES + payload.byteLength);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setUint32(0, opId, true);
    view.setUint16(4, kind, true);
    view.setUint32(6, payload.byteLength, true);
    if (payload.byteLength > 0) {
        out.set(payload, BINARY_ENVELOPE_HEADER_BYTES);
    }
    return out;
};

export const decodeEnvelope = (buf: Uint8Array): DecodedEnvelope => {
    if (buf.byteLength < BINARY_ENVELOPE_HEADER_BYTES) {
        throw new RangeError(`binary-envelope: buffer too short (${buf.byteLength} < ${BINARY_ENVELOPE_HEADER_BYTES})`);
    }

    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const opId = view.getUint32(0, true);
    const kind = view.getUint16(4, true) as EnvelopeKind;
    const payloadLen = view.getUint32(6, true);
    const expectedLen = BINARY_ENVELOPE_HEADER_BYTES + payloadLen;

    if (buf.byteLength < expectedLen) {
        throw new RangeError(`binary-envelope: truncated payload (have ${buf.byteLength}, need ${expectedLen})`);
    }

    const payload = new Uint8Array(
        buf.buffer,
        buf.byteOffset + BINARY_ENVELOPE_HEADER_BYTES,
        payloadLen
    );

    return { opId, kind, payload };
};

/**
 * Coerces arbitrary Node/browser buffer-shaped inputs into a `Uint8Array`
 * view (no copy when the source already is a typed array). Used at the
 * Socket.IO/IPC boundary where payloads may also arrive as Node's serialized
 * Buffer shape (`{ type: 'Buffer', data: [...] }`).
 */
export const toUint8Array = (value: unknown): Uint8Array => {
    if (value instanceof Uint8Array) {
        return value;
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    if (ArrayBuffer.isView(value)) {
        const view = value as ArrayBufferView;
        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }

    if (Array.isArray(value)) {
        return Uint8Array.from(value);
    }

    if (value && typeof value === 'object') {
        const serialized = value as SerializedBuffer;
        if (Array.isArray(serialized.data)) {
            return Uint8Array.from(serialized.data);
        }

        if (typeof serialized.length === 'number' && Number.isInteger(serialized.length) && serialized.length >= 0) {
            const bytes = new Uint8Array(serialized.length);
            for (let index = 0; index < serialized.length; index += 1) {
                const byte = (value as Record<string, unknown>)[String(index)];
                if (typeof byte !== 'number') {
                    throw new TypeError('binary-envelope: numeric buffer object contains non-number byte');
                }
                bytes[index] = byte;
            }
            return bytes;
        }

        const numericKeys = Object.keys(serialized)
            .filter((key) => /^(0|[1-9]\d*)$/.test(key))
            .map((key) => Number(key))
            .sort((left, right) => left - right);
        if (numericKeys.length > 0 && numericKeys.every((key, index) => key === index)) {
            const bytes = new Uint8Array(numericKeys.length);
            for (const index of numericKeys) {
                const byte = (value as Record<string, unknown>)[String(index)];
                if (typeof byte !== 'number') {
                    throw new TypeError('binary-envelope: numeric-key buffer object contains non-number byte');
                }
                bytes[index] = byte;
            }
            return bytes;
        }
    }

    throw new TypeError('binary-envelope: expected binary chunk');
};
