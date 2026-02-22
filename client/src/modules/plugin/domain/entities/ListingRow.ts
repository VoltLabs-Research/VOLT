export interface ListingRow {
    _id: string;
    trajectoryId?: string;
    trajectoryName?: string;
    analysisId?: string;
    exposureId?: string;
    timestep?: number;
    [key: string]: unknown;
};
