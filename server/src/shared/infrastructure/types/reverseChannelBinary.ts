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

export const encodeJsonEnvelope = (opId: number, value: unknown): Uint8Array => {
    const json = JSON.stringify(value);
    const payload = Buffer.from(json, 'utf8');
    return encodeEnvelope(opId, EnvelopeKind.CommandJson, payload);
};

export const decodeJsonEnvelope = <T>(buf: Uint8Array): { opId: number; value: T } => {
    const { opId, kind, payload } = decodeEnvelope(buf);
    if (kind !== EnvelopeKind.CommandJson) {
        throw new Error(`binary-envelope: expected CommandJson kind, got ${kind}`);
    }
    const json = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString('utf8');
    return { opId, value: JSON.parse(json) as T };
};

/**
 * Coerces arbitrary Node/browser buffer-shaped inputs into a `Uint8Array`
 * view (no copy when the source already is a typed array). Used at the
 * Socket.IO boundary where payloads arrive as `Buffer | ArrayBuffer | Uint8Array`.
 */
export const toUint8Array = (value: Uint8Array | ArrayBuffer | Buffer): Uint8Array => {
    if (value instanceof Uint8Array) {
        return value;
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }
    throw new TypeError('binary-envelope: expected Uint8Array/Buffer/ArrayBuffer');
};
