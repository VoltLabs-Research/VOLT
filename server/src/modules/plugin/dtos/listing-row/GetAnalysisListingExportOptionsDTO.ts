export interface GetAnalysisListingExportOptionsInputDTO {
    analysisId: string;
    teamId: string;
}

export interface AnalysisListingExportOptionDTO {
    id: string;
    listingId: string;
    listingName: string;
    label: string;
}

export interface AnalysisSubListingExportOptionDTO {
    id: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    label: string;
}

export interface GetAnalysisListingExportOptionsOutputDTO {
    analysisId: string;
    hasConfig: boolean;
    listings: AnalysisListingExportOptionDTO[];
    subListings: AnalysisSubListingExportOptionDTO[];
}
