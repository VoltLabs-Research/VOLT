export interface GetAtomsColumnarInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    page?: number;
    limit?: number;
};

export type AtomColumnDType = 'f32' | 'u32' | 'u16';

export interface AtomColumn {
    name: string;
    dtype: AtomColumnDType;
    /**
     * Little-endian packed values. Callers concat directly onto the wire body;
     * no per-row intermediate JSON representation exists.
     */
    buffer: Uint8Array;
}

export interface GetAtomsColumnarOutputDTO {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    columns: AtomColumn[];
    propertyNames: string[];
};
