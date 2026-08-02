import type {
    AtomColumnDType,
    GetAtomsColumnarOutput
} from '@modules/trajectory/services/TrajectoryServiceTypes';

const DTYPE_ID: Record<AtomColumnDType, number> = {
    f32: 0,
    u32: 1,
    u16: 2,
    str: 3,
    i32: 4
};

/**
 * Serialises a columnar atoms page into the binary envelope the viewer decodes:
 * a 24-byte paging header, one descriptor per column (name length, utf8 name,
 * dtype id, byte length), a 4-byte trailing pad field that 4-byte aligns the
 * envelope, then every column buffer back to back.
 */
export const encodeAtomsBinary = (result: GetAtomsColumnarOutput): Buffer => {
    const columns = result.columns;
    const nameBuffers = columns.map((column) => Buffer.from(column.name, 'utf8'));

    let headerSize = 16 + 4 + 4;

    for (let i = 0; i < columns.length; i += 1) {
        const nameBuffer = nameBuffers[i];
        // The name length is a single wire byte, and atom property names come
        // from user-supplied dump headers.
        if (nameBuffer.byteLength > 0xFF) {
            throw new Error(`Atom property name exceeds 255 bytes: ${columns[i].name}`);
        }

        headerSize += 1 + nameBuffer.byteLength + 1 + 4;
    }

    const headerSizeWithPadField = headerSize + 4;
    const padBytes = (4 - (headerSizeWithPadField % 4)) % 4;
    const envelopeSize = headerSizeWithPadField + padBytes;

    const envelope = Buffer.alloc(envelopeSize);
    let offset = 0;
    envelope.writeUInt32LE(result.total, offset);
    offset += 4;
    envelope.writeUInt32LE(result.page, offset);
    offset += 4;
    envelope.writeUInt32LE(result.limit, offset);
    offset += 4;
    envelope.writeUInt32LE(result.totalPages, offset);
    offset += 4;
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

    const parts: Buffer[] = [envelope];
    for (const column of columns) {
        parts.push(Buffer.from(column.buffer.buffer, column.buffer.byteOffset, column.buffer.byteLength));
    }

    return Buffer.concat(parts);
};
