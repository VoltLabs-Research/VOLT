import type { PaginatedResponse } from '@/shared/domain/pagination'

export interface GetAtomsInputDTO {
    trajectoryId: string;
    analysisId: string;
    exposureId?: string;
    timestep: number;
    page: number;
    limit: number;
}

export interface AtomData {
    id: number;
    type: string | number;
    x: number;
    y: number;
    z: number;
    [key: string]: unknown;
}

export interface GetAtomsOutputDTO extends PaginatedResponse<AtomData> {
    _meta?: {
        properties: string[];
    };
}
