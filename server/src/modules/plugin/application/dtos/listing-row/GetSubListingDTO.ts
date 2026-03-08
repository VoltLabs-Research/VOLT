export interface GetSubListingInputDTO {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    teamId: string;
    page?: number;
    limit?: number;
};

export interface SubListingColumn {
    label: string;
    sortable: boolean;
};

export interface SubListingRowShape extends Record<string, unknown> {
    _id: string;
};

export type SubListingRowData = SubListingRowShape;

export interface GetSubListingOutputDTO {
    subListingName: string;
    columns: SubListingColumn[];
    rows: SubListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};
