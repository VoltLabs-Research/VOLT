export interface GetListingRowsByAnalysisIdInputDTO {
    analysisId: string;
    teamId: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
};

export interface ListingRowByAnalysisData {
    _id: string;
    plugin: string;
    exposureId: string;
    exposureName: string;
    trajectory: string;
    trajectoryName: string;
    timestep: number;
    row: any;
};

export interface GetListingRowsByAnalysisIdOutputDTO {
    data: ListingRowByAnalysisData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};
