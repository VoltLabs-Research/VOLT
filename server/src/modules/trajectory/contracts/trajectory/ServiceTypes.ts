/**
 * Service-facing types for the trajectory module. These were previously spread
 * across `dtos/`; they now live beside the module's other neutral contracts so
 * the plain `TrajectoryService` (which folds the old use-cases) and the handful
 * of retained collaborators (atoms binary encoder, preview reader / responder,
 * particle-filter request builder) share one canonical definition without a
 * dedicated dtos layer.
 */

export interface GetAtomsColumnarInputDTO {
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
}

/** Base64 PNG preview payload plus the matching strong ETag. */
export interface TrajectoryPreviewResult {
    base64: string;
    etag: string;
}

/** A single client-supplied particle-filter condition (pre-normalisation). */
export interface ParticleFilterConditionInput {
    property: string;
    operator: string;
    value: number | string;
    exposureId?: string;
}
