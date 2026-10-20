export type ColumnDType = 'i32' | 'f32';

export interface TypedColumn {
    dtype: ColumnDType;
    values: Int32Array | Float32Array;
}

export interface ElementTableEntry {

    type: number;

    symbol: string;

    displayName: string;

    color: [number, number, number];

    radius: number;

    mass: number;

    covalentRadius: number;

    vdwRadius: number;

    maxCoordination: number;
}
