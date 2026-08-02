export type ColumnDType = 'i32' | 'f32';

export interface TypedColumn {
    dtype: ColumnDType;
    values: Int32Array | Float32Array;
}

/**
 * One atom type as described by a trajectory's element table.
 *
 * The daemon only ever *reads* these: the table is produced upstream and arrives
 * inside the parquet frame store. The builder that used to construct entries from
 * a bundled periodic table had no callers and was removed along with it.
 */
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
