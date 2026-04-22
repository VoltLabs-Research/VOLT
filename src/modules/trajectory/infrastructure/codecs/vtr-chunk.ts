import {
    VTR_CHUNK_FLAG_DEDUP,
    VTR_DEDUP_PAYLOAD_SIZE,
    VTR_SHA256_SIZE,
    VtrColumnData,
    VtrColumnEncoding,
    VtrDtype,
    VtrFrameChunkBody,
    VtrFrameKind
} from '@/modules/trajectory/contracts/vtr-format';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: false });

const CHUNK_HEADER_SIZE = 1 + 1 + 1 + 1 + 2 + 6 * 4;

const measureColumnSize = (column: VtrColumnData): number => {
    return 2 + TEXT_ENCODER.encode(column.name).length + 1 + 1 + 2 + 4 + column.data.byteLength;
};

const measureChunkSize = (body: VtrFrameChunkBody): number => {
    if ((body.flags & VTR_CHUNK_FLAG_DEDUP) !== 0) {
        return CHUNK_HEADER_SIZE + VTR_DEDUP_PAYLOAD_SIZE;
    }
    let size = CHUNK_HEADER_SIZE;
    for (const column of body.columns) {
        size += measureColumnSize(column);
    }
    return size;
};

export const encodeFrameChunkBody = (body: VtrFrameChunkBody): Uint8Array => {
    const size = measureChunkSize(body);
    const buffer = new Uint8Array(size);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    view.setUint8(offset, 1);
    offset += 1;
    view.setUint8(offset, 0);
    offset += 1;
    view.setUint8(offset, body.frameKind);
    offset += 1;
    view.setUint8(offset, body.flags);
    offset += 1;
    const columnCount = (body.flags & VTR_CHUNK_FLAG_DEDUP) !== 0 ? 0 : body.columns.length;
    view.setUint16(offset, columnCount, true);
    offset += 2;

    for (let axis = 0; axis < 6; axis++) {
        view.setFloat32(offset, body.frameBbox[axis], true);
        offset += 4;
    }

    if ((body.flags & VTR_CHUNK_FLAG_DEDUP) !== 0) {
        if (!body.dedupRef) {
            throw new Error('dedup flag set but no dedupRef payload supplied');
        }
        if (body.dedupRef.hash.byteLength !== VTR_SHA256_SIZE) {
            throw new Error(`dedupRef.hash must be ${VTR_SHA256_SIZE} bytes`);
        }
        buffer.set(body.dedupRef.hash, offset);
        offset += VTR_SHA256_SIZE;
        view.setUint32(offset, body.dedupRef.size, true);
        offset += 4;
        return buffer;
    }

    for (const column of body.columns) {
        const nameBytes = TEXT_ENCODER.encode(column.name);
        view.setUint16(offset, nameBytes.length, true);
        offset += 2;
        buffer.set(nameBytes, offset);
        offset += nameBytes.length;
        view.setUint8(offset, column.dtype);
        offset += 1;
        view.setUint8(offset, column.encoding);
        offset += 1;
        view.setUint16(offset, 0, true);
        offset += 2;
        view.setUint32(offset, column.data.byteLength, true);
        offset += 4;
        buffer.set(column.data, offset);
        offset += column.data.byteLength;
    }

    return buffer;
};

export const decodeFrameChunkBody = (data: Uint8Array): VtrFrameChunkBody => {
    if (data.byteLength < CHUNK_HEADER_SIZE) {
        throw new Error(`vtr chunk too small: ${data.byteLength} bytes`);
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const version = view.getUint8(offset);
    offset += 1;
    if (version !== 1) throw new Error(`vtr chunk version mismatch: ${version}`);
    offset += 1; // codecId (informational, redundant with index)
    const frameKind = view.getUint8(offset) as VtrFrameKind;
    offset += 1;
    const flags = view.getUint8(offset);
    offset += 1;
    const columnCount = view.getUint16(offset, true);
    offset += 2;

    const frameBbox: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
    for (let axis = 0; axis < 6; axis++) {
        frameBbox[axis] = view.getFloat32(offset, true);
        offset += 4;
    }

    if ((flags & VTR_CHUNK_FLAG_DEDUP) !== 0) {
        const hash = new Uint8Array(VTR_SHA256_SIZE);
        hash.set(new Uint8Array(data.buffer, data.byteOffset + offset, VTR_SHA256_SIZE));
        offset += VTR_SHA256_SIZE;
        const size = view.getUint32(offset, true);
        offset += 4;
        return {
            frameKind,
            flags,
            frameBbox,
            columns: [],
            dedupRef: { hash, size }
        };
    }

    const columns: VtrColumnData[] = [];
    for (let index = 0; index < columnCount; index++) {
        const nameLen = view.getUint16(offset, true);
        offset += 2;
        const name = TEXT_DECODER.decode(new Uint8Array(data.buffer, data.byteOffset + offset, nameLen));
        offset += nameLen;
        const dtype = view.getUint8(offset) as VtrDtype;
        offset += 1;
        const encoding = view.getUint8(offset) as VtrColumnEncoding;
        offset += 1;
        offset += 2;
        const byteLen = view.getUint32(offset, true);
        offset += 4;
        const payload = new Uint8Array(byteLen);
        payload.set(new Uint8Array(data.buffer, data.byteOffset + offset, byteLen));
        offset += byteLen;
        columns.push({ name, dtype, encoding, data: payload });
    }

    return { frameKind, flags, frameBbox, columns };
};
