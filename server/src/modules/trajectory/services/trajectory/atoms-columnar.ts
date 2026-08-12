import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { AtomPageResult } from '@modules/trajectory/services/native/TrajectoryNativeTypes';
import type { AtomColumn, GetAtomsColumnarOutput } from '@modules/trajectory/services/TrajectoryServiceTypes';

const ID_PROPERTY_NAME = 'id';
const TYPE_PROPERTY_NAME = 'type';
const POSITION_PROPERTY_NAMES = ['x', 'y', 'z'];
const FIXED_COLUMN_NAMES = new Set([ID_PROPERTY_NAME, TYPE_PROPERTY_NAME, ...POSITION_PROPERTY_NAMES]);

const encodeStringColumn = (values: unknown[]): Buffer => {
    const encoded = values.map((value) => Buffer.from(value == null ? '' : String(value), 'utf8'));
    const buffer = Buffer.alloc(encoded.reduce((size, bytes) => size + 4 + bytes.byteLength, 0));
    let offset = 0;

    for (const bytes of encoded) {
        offset = buffer.writeUInt32LE(bytes.byteLength, offset);
        offset += bytes.copy(buffer, offset);
    }

    return buffer;
};

const encodeFloatColumn = (values: unknown[]): Uint8Array => {
    const buffer = new ArrayBuffer(values.length * Float32Array.BYTES_PER_ELEMENT);
    new Float32Array(buffer).set(values.map((value) => (
        typeof value === 'number' ? value : Number(value ?? Number.NaN)
    )));

    return new Uint8Array(buffer);
};

const isStringColumn = (values: unknown[]): boolean => values.some((value) => (
    typeof value === 'string' && !Number.isFinite(Number(value))
));

export const concatAtomsColumnarOutputs = (
    pages: GetAtomsColumnarOutput[],
    page: number,
    limit: number
): GetAtomsColumnarOutput => {
    if (pages.length === 1) {
        return pages[0];
    }

    const [first] = pages;
    const order: string[] = first.columns.map((column) => column.name);
    const dtypes = new Map(first.columns.map((column) => [column.name, column.dtype]));
    const buffers = new Map<string, Uint8Array[]>(order.map((name) => [name, []]));

    let count = 0;
    for (const current of pages) {
        count += current.count;
        for (const column of current.columns) {
            const expected = dtypes.get(column.name);
            if (expected === undefined) {
                throw ApplicationError.internalServerError(
                    `${ErrorCodes.TRAJECTORY_ATOMS_PAGE_MISMATCH}: column ${column.name} `
                    + 'appeared only in part of the atoms range'
                );
            }
            if (expected !== column.dtype) {
                throw ApplicationError.internalServerError(
                    `${ErrorCodes.TRAJECTORY_ATOMS_PAGE_MISMATCH}: column ${column.name} `
                    + `changed type between atom chunks (${expected} then ${column.dtype})`
                );
            }
            buffers.get(column.name)!.push(column.buffer);
        }
    }

    return {
        count,
        total: first.total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(first.total / limit) : 1,
        columns: order.map((name) => ({
            name,
            dtype: dtypes.get(name)!,
            buffer: concatBuffers(buffers.get(name)!)
        })),
        propertyNames: first.propertyNames
    };
};

const concatBuffers = (parts: Uint8Array[]): Uint8Array => {
    const total = parts.reduce((size, part) => size + part.byteLength, 0);
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        joined.set(part, offset);
        offset += part.byteLength;
    }
    return joined;
};

export const toAtomsColumnarOutput = (
    atomsPage: AtomPageResult,
    page: number,
    limit: number
): GetAtomsColumnarOutput => {
    const propertyNames = [...atomsPage.nativeProperties, ...(atomsPage.analysisPropertyNames ?? [])];

    const analysisByAtomId = new Map<number, Record<string, unknown>>();
    for (const item of atomsPage.analysisAtoms ?? []) {
        if (item.id === undefined) continue;
        analysisByAtomId.set(Number(item.id), item);
    }

    const rowCount = atomsPage.atoms.length;
    const idBuffer = new ArrayBuffer(rowCount * Uint32Array.BYTES_PER_ELEMENT);
    const typeBuffer = new ArrayBuffer(rowCount * Uint32Array.BYTES_PER_ELEMENT);
    const xBuffer = new ArrayBuffer(rowCount * Float32Array.BYTES_PER_ELEMENT);
    const yBuffer = new ArrayBuffer(rowCount * Float32Array.BYTES_PER_ELEMENT);
    const zBuffer = new ArrayBuffer(rowCount * Float32Array.BYTES_PER_ELEMENT);
    const ids = new Uint32Array(idBuffer);
    const types = new Uint32Array(typeBuffer);
    const xs = new Float32Array(xBuffer);
    const ys = new Float32Array(yBuffer);
    const zs = new Float32Array(zBuffer);

    const extraColumns = new Map<string, unknown[]>();
    for (const property of propertyNames) {
        if (FIXED_COLUMN_NAMES.has(property)) continue;
        extraColumns.set(property, new Array<unknown>(rowCount));
    }

    for (let row = 0; row < rowCount; row += 1) {
        const atom = atomsPage.atoms[row];
        ids[row] = atom.id;
        types[row] = atom.type;
        xs[row] = atom.x;
        ys[row] = atom.y;
        zs[row] = atom.z;

        for (const [property, column] of extraColumns) {
            const nativeValue = atom[property];
            column[row] = typeof nativeValue === 'number'
                ? nativeValue
                : analysisByAtomId.get(atom.id)?.[property] ?? nativeValue;
        }
    }

    const columns: AtomColumn[] = [
        {
 name: ID_PROPERTY_NAME, dtype: 'u32', buffer: new Uint8Array(idBuffer) 
},
        {
 name: TYPE_PROPERTY_NAME, dtype: 'u32', buffer: new Uint8Array(typeBuffer) 
},
        {
 name: 'x', dtype: 'f32', buffer: new Uint8Array(xBuffer) 
},
        {
 name: 'y', dtype: 'f32', buffer: new Uint8Array(yBuffer) 
},
        {
 name: 'z', dtype: 'f32', buffer: new Uint8Array(zBuffer) 
}
    ];

    const stringColumns: AtomColumn[] = [];
    for (const [property, values] of extraColumns) {
        if (isStringColumn(values)) {
            stringColumns.push({
 name: property, dtype: 'str', buffer: encodeStringColumn(values) 
});
            continue;
        }
        columns.push({
 name: property, dtype: 'f32', buffer: encodeFloatColumn(values) 
});
    }
    columns.push(...stringColumns);

    return {
        count: rowCount,
        total: atomsPage.totalAtoms,
        page,
        limit,
        totalPages: Math.ceil(atomsPage.totalAtoms / limit),
        columns,
        propertyNames
    };
};
