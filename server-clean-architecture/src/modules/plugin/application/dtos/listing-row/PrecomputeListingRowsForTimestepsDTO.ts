export interface PrecomputeListingRowsForTimestepsInputDTO{
    pluginId: string;
    teamId: string;
    trajectoryId: string;
    analysisId: string;
    listingSlug: string;
    timesteps: number[];
};