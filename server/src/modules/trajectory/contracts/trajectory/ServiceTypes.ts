

export interface GetAtomsColumnarInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    page?: number;
    limit?: number;
}

export type AtomColumnDType = 'f32' | 'u32' | 'u16' | 'str' | 'i32';

export interface AtomColumn {
    name: string;
    dtype: AtomColumnDType;
    
    buffer: Uint8Array;
}

export interface GetAtomsColumnarOutput {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    columns: AtomColumn[];
    propertyNames: string[];
}

export interface TrajectoryPreviewResult {
    base64: string;
    etag: string;
}

export interface ParticleFilterConditionInput {
    property: string;
    operator: string;
    value: number | string;
    exposureId?: string;
}
