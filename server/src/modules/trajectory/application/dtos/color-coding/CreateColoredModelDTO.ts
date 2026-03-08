export interface CreateColoredModelInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
};

export type CreateColoredModelOutputDTO = null;
