export interface PrecomputeListingRowsForTimestepsInputDTO {
    pluginId: string;
    teamId: string;
    trajectoryId: string;
    analysisId: string;
    exposureName: string;
    timesteps: number[];
}
