export interface TriggerRasterizationInputDTO {
    trajectoryId: string;
    teamId: string;
    config?: unknown;
}

export interface TriggerRasterizationOutputDTO {
    message: string;
    trajectoryId: string;
    triggered: boolean;
}
