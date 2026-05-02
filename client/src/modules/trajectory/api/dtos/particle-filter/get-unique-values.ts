export interface GetUniqueValuesInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property: string;
    exposureId?: string;
    maxValues?: number;
}

export interface GetUniqueValuesOutputDTO {
    values: number[];
}
