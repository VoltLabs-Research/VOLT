export interface GetAtomsInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    page?: number;
    limit?: number;
};

export type AtomColumnDType = 'f32' | 'u32' | 'u16';

export interface AtomColumnView {
    name: string;
    dtype: AtomColumnDType;
    values: Float32Array | Uint32Array | Uint16Array;
};

export interface GetAtomsOutputDTO {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    propertyNames: string[];
    columns: AtomColumnView[];
    getColumn: (name: string) => AtomColumnView | undefined;
};

/**
 * Per-atom row projection, reconstructed lazily from the columnar body when a
 * consumer still expects the legacy AoS shape (tables/debug UI). Prefer
 * `getColumn` when only one property is needed — it skips the intermediate row
 * allocation entirely.
 */
export interface AtomData {
    id: number;
    type: string | number;
    x: number;
    y: number;
    z: number;
    [key: string]: unknown;
};
