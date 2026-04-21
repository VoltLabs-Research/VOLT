import type {
    AtomColumnDType,
    GetAtomsColumnarOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';

const DTYPE_ID: Record<AtomColumnDType, number> = {
    f32: 0,
    u32: 1,
    u16: 2
};

const DTYPE_BYTES: Record<AtomColumnDType, number> = {
    f32: 4,
    u32: 4,
    u16: 2
};

/**
 * Wire format (little-endian throughout):
 *   [u32 count]
 *   [u32 propsCount]
 *   for each prop:
 *     [u8 nameLen][bytes name][u8 dtypeId][u32 byteLen]
 *   [u32 headerPadLen][padLen zero bytes]   // pads block to a 4-byte boundary
 *   [data blocks contiguous in prop order]
 *
 * `dtypeId` map: 0 = f32, 1 = u32, 2 = u16.
 *
 * Why the pad: Float32Array / Uint32Array TypedArray views require the
 * source `byteOffset` to be a multiple of the element size. The per-prop
 * header has variable length (nameLen), so a naive concat would land the
 * first data block at an arbitrary offset. The explicit pad field keeps the
 * wire format self-describing.
 */
export const encodeAtomsBinary = (result: GetAtomsColumnarOutputDTO): Buffer => {
    const columns = result.columns;
    const nameBuffers = columns.map((column) => Buffer.from(column.name, 'utf8'));

    let headerSize = 4 /* count */ + 4 /* propsCount */;
    let dataSize = 0;

    for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        const nameBuffer = nameBuffers[i];
        if (nameBuffer.byteLength > 0xFF) {
            throw new Error(`Atom property name exceeds 255 bytes: ${column.name}`);
        }

        if (DTYPE_ID[column.dtype] === undefined) {
            throw new Error(`Unsupported atom column dtype: ${column.dtype}`);
        }

        const elementSize = DTYPE_BYTES[column.dtype];
        if (column.buffer.byteLength % elementSize !== 0) {
            throw new Error(`Atom column buffer length not aligned to dtype size: ${column.name}`);
        }

        headerSize += 1 /* nameLen */ + nameBuffer.byteLength + 1 /* dtypeId */ + 4 /* byteLen */;
        dataSize += column.buffer.byteLength;
    }

    const headerSizeWithPadField = headerSize + 4;
    const padBytes = (4 - (headerSizeWithPadField % 4)) % 4;
    const envelopeSize = headerSizeWithPadField + padBytes;

    const envelope = Buffer.alloc(envelopeSize);
    let offset = 0;
    envelope.writeUInt32LE(result.count, offset);
    offset += 4;
    envelope.writeUInt32LE(columns.length, offset);
    offset += 4;

    for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        const nameBuffer = nameBuffers[i];
        envelope.writeUInt8(nameBuffer.byteLength, offset);
        offset += 1;
        nameBuffer.copy(envelope, offset);
        offset += nameBuffer.byteLength;
        envelope.writeUInt8(DTYPE_ID[column.dtype], offset);
        offset += 1;
        envelope.writeUInt32LE(column.buffer.byteLength, offset);
        offset += 4;
    }

    envelope.writeUInt32LE(padBytes, offset);
    offset += 4;
    // Remaining bytes in `envelope` are already zero-filled by Buffer.alloc.

    const parts: Buffer[] = [envelope];
    for (const column of columns) {
        parts.push(Buffer.from(column.buffer.buffer, column.buffer.byteOffset, column.buffer.byteLength));
    }

    return Buffer.concat(parts, envelopeSize + dataSize);
};
