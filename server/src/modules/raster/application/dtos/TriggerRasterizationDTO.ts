export interface TriggerRasterizationInputDTO {
    trajectoryId: string;
    teamId: string;
    config?: unknown;
}

export interface TriggerRasterizationOutputDTO {
    trajectoryId: string;
    triggered: boolean;
}
