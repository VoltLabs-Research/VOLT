export interface GetAtomsInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep?: string;
    exposureId?: string;
    page?: number;
    limit?: number;
}

export interface AtomRecord {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
    [property: string]: unknown;
}
