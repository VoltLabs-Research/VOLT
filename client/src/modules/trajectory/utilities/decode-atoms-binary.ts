import type { AtomColumnDType, AtomColumnView, AtomData, GetAtomsOutputDTO } from '@/modules/trajectory/api/services/trajectory-service';

const DTYPE_BY_ID: Record<number, AtomColumnDType> = {
    0: 'f32',
    1: 'u32',
    2: 'u16',
    3: 'str'
};

const createTypedArrayView = (
    dtype: Exclude<AtomColumnDType, 'str'>,
    buffer: ArrayBuffer,
    byteOffset: number,
    byteLength: number
): AtomColumnView['values'] => {
    switch (dtype) {
        case 'f32':
            return new Float32Array(buffer, byteOffset, byteLength / Float32Array.BYTES_PER_ELEMENT);
        case 'u32':
            return new Uint32Array(buffer, byteOffset, byteLength / Uint32Array.BYTES_PER_ELEMENT);
        case 'u16':
            return new Uint16Array(buffer, byteOffset, byteLength / Uint16Array.BYTES_PER_ELEMENT);
        default: {
            const exhaustive: never = dtype;
            throw new Error(`Unsupported atom column dtype: ${exhaustive}`);
        }
    }
};

/**
 * Decodes the F2.S4 atoms wire format into column views that alias the source
 * ArrayBuffer — no per-row materialization, no JSON parsing.
 *
 * Format (little-endian):
 *   [u32 total][u32 page][u32 limit][u32 totalPages]
 *   [u32 count][u32 propsCount]
 *   for each prop: [u8 nameLen][bytes name utf-8][u8 dtypeId][u32 byteLen]
 *   [u32 headerPadLen][padLen zero bytes]
 *   [data blocks contiguous in prop order]
 *
 * The returned columns share the response `ArrayBuffer`; callers must not
 * mutate the buffer while views are alive.
 */
export const decodeAtomsBinary = (buffer: ArrayBuffer): GetAtomsOutputDTO => {
    const view = new DataView(buffer);
    let offset = 0;

    const total = view.getUint32(offset, true);
    offset += 4;
    const page = view.getUint32(offset, true);
    offset += 4;
    const limit = view.getUint32(offset, true);
    offset += 4;
    const totalPages = view.getUint32(offset, true);
    offset += 4;
    const count = view.getUint32(offset, true);
    offset += 4;
    const propsCount = view.getUint32(offset, true);
    offset += 4;

    interface Header {
        name: string;
        dtype: AtomColumnDType;
        byteLen: number;
    }

    const headers: Header[] = new Array(propsCount);
    const textDecoder = new TextDecoder('utf-8');

    for (let i = 0; i < propsCount; i += 1) {
        const nameLen = view.getUint8(offset);
        offset += 1;
        const name = textDecoder.decode(new Uint8Array(buffer, offset, nameLen));
        offset += nameLen;
        const dtypeId = view.getUint8(offset);
        offset += 1;
        const byteLen = view.getUint32(offset, true);
        offset += 4;

        const dtype = DTYPE_BY_ID[dtypeId];
        if (!dtype) {
            throw new Error(`Unknown atom column dtype id: ${dtypeId}`);
        }

        headers[i] = { name, dtype, byteLen };
    }

    // Skip the alignment pad declared by the encoder. The pad width itself is
    // a u32 followed by `headerPadLen` zero bytes; together they snap the data
    // section to a 4-byte boundary so TypedArray views are legal.
    const headerPadLen = view.getUint32(offset, true);
    offset += 4 + headerPadLen;

    const columns: AtomColumnView[] = new Array(propsCount);
    const columnsByName = new Map<string, AtomColumnView>();

    for (let i = 0; i < propsCount; i += 1) {
        const header = headers[i];
        let values: AtomColumnView['values'];

        if (header.dtype === 'str') {
            const strings: string[] = [];
            const end = offset + header.byteLen;
            while (offset < end) {
                const strLen = view.getUint32(offset, true);
                offset += 4;
                strings.push(textDecoder.decode(new Uint8Array(buffer, offset, strLen)));
                offset += strLen;
            }
            values = strings;
        } else {
            values = createTypedArrayView(header.dtype, buffer, offset, header.byteLen);
            offset += header.byteLen;
        }

        const column: AtomColumnView = {
            name: header.name,
            dtype: header.dtype,
            values
        };
        columns[i] = column;
        columnsByName.set(header.name, column);
    }

    return {
        count,
        total,
        page,
        limit,
        totalPages,
        propertyNames: columns.map((column) => column.name),
        columns,
        getColumn: (name: string) => columnsByName.get(name)
    };
};

/**
 * Materializes the columnar payload as an Array-of-Structures.
 *
 * Only use this in tables/debug UIs that cannot consume TypedArrays directly —
 * it allocates one object per atom and defeats the point of binary transfer.
 */
export const atomsToAoS = (result: GetAtomsOutputDTO): AtomData[] => {
    const rows: AtomData[] = new Array(result.count);
    const columns = result.columns;

    for (let row = 0; row < result.count; row += 1) {
        const atom: AtomData = {
            id: 0,
            type: 0,
            x: 0,
            y: 0,
            z: 0
        };

        for (const column of columns) {
            atom[column.name] = column.values[row];
        }

        rows[row] = atom;
    }

    return rows;
};
