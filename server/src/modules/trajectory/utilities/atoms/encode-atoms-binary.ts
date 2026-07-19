import type {
    AtomColumnDType,
    GetAtomsColumnarOutput
} from '@modules/trajectory/contracts/trajectory';

const DTYPE_ID: Record<AtomColumnDType, number> = {
    f32: 0,
    u32: 1,
    u16: 2,
    str: 3,
    i32: 4
};

const DTYPE_BYTES: Record<AtomColumnDType, number> = {
    f32: 4,
    u32: 4,
    u16: 2,
    str: 1,
    i32: 4
};

export const encodeAtomsBinary = (result: GetAtomsColumnarOutput): Buffer => {
    const columns = result.columns;
    const nameBuffers = columns.map((column) => Buffer.from(column.name, 'utf8'));

    let headerSize = 16 + 4 + 4;
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

        headerSize += 1 + nameBuffer.byteLength + 1 + 4;
        dataSize += column.buffer.byteLength;
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
    offset += 4;

    const parts: Buffer[] = [envelope];
    for (const column of columns) {
        parts.push(Buffer.from(column.buffer.buffer, column.buffer.byteOffset, column.buffer.byteLength));
    }

    return Buffer.concat(parts, envelopeSize + dataSize);
};
