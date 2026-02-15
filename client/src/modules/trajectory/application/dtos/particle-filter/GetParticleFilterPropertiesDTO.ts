export interface GetFilterPropertiesInputDTO{
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
}

export interface FilterPropertiesData{
    base: string[];
    modifiers: Record<string, string[]>;
}

export type GetFilterPropertiesOutputDTO = FilterPropertiesData;