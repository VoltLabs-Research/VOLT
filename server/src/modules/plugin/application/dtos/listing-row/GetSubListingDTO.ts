export interface GetSubListingInputDTO {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    teamId: string;
}

export interface SubListingColumn {
    label: string;
    sortable: boolean;
}

export interface GetSubListingOutputDTO {
    subListingName: string;
    columns: SubListingColumn[];
    rows: Record<string, unknown>[];
}
