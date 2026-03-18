export interface GetFilterPropertiesInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
};

export interface FilterPropertiesData {
    dump: string[];
    perAtom: Record<string, string[]>;
    exposureNames: Record<string, string>;
};

export interface GetFilterPropertiesOutputDTO {
};
