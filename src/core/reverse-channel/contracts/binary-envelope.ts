/**
 * Binary envelope contract for the reverse channel between Volt/server and
 * ClusterDaemon. Replaces the legacy base64/JSON carrier for command payloads,
 * responses, tunnel chunks and session chunks.
 *
 * Wire format (little-endian, fixed 10-byte header):
 *   [u32 opId][u16 kind][u32 payloadLen][...payload bytes...]
 *
 * The envelope itself travels as a raw `Uint8Array` field inside the
 * Socket.IO message. Socket.IO v4 emits typed arrays as binary packet
 * attachments, so there is zero base64 overhead on the wire.
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

/**
 * Encodes a binary envelope. The returned `Uint8Array` contains the 10-byte
 * header followed by the payload. A single allocation is performed; the
 * payload bytes are copied into the tail of the output.
 */
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

/**
 * Decodes a binary envelope.
 *
 * The returned `payload` is a **view** over the source buffer (zero-copy),
 * so callers must not mutate the envelope bytes if they still hold the view.
 * Callers that need long-lived storage should copy via `payload.slice()`.
 */
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
 * Builds an envelope whose payload is a raw UTF-8 JSON string. Useful for
 * command metadata that must travel alongside binary attachments.
 */
export const encodeJsonEnvelope = (opId: number, value: unknown): Uint8Array => {
    const payload = Buffer.from(JSON.stringify(value), 'utf8');
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
 * Packs a JSON metadata blob + raw binary attachment into a single envelope
 * payload: `[u32 jsonLen][utf8 json bytes][binary bytes]`. This is the body
 * the `command-binary` / `response-binary` carriers use so that commands
 * needing both structured params and typed-array data can travel as a
 * single buffer without a second Socket.IO binary attachment.
 */
export const encodeCommandPayload = (metadata: unknown, binary: Uint8Array): Uint8Array => {
    const json = Buffer.from(JSON.stringify(metadata), 'utf8');
    const out = new Uint8Array(4 + json.byteLength + binary.byteLength);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setUint32(0, json.byteLength, true);
    out.set(json, 4);
    if (binary.byteLength > 0) {
        out.set(binary, 4 + json.byteLength);
    }
    return out;
};

export interface DecodedCommandPayload<T> {
    metadata: T;
    binary: Uint8Array;
}

export const decodeCommandPayload = <T>(payload: Uint8Array): DecodedCommandPayload<T> => {
    if (payload.byteLength < 4) {
        throw new RangeError(`binary-envelope: command payload too short (${payload.byteLength} < 4)`);
    }
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const jsonLen = view.getUint32(0, true);
    if (payload.byteLength < 4 + jsonLen) {
        throw new RangeError(`binary-envelope: command payload truncated (have ${payload.byteLength}, need ${4 + jsonLen})`);
    }
    const jsonBytes = new Uint8Array(payload.buffer, payload.byteOffset + 4, jsonLen);
    const json = Buffer.from(jsonBytes.buffer, jsonBytes.byteOffset, jsonBytes.byteLength).toString('utf8');
    const binary = new Uint8Array(payload.buffer, payload.byteOffset + 4 + jsonLen, payload.byteLength - 4 - jsonLen);
    return { metadata: JSON.parse(json) as T, binary };
};
