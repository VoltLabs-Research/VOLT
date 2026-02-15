export interface GetPluginListingDocumentsInputDTO {
    pluginSlug: string;
    listingSlug: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
};

export interface ColumnDef {
    path: string;
    label: string;
};

export interface ListingRowData {
    _id: string;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    exposureId: string;
    trajectoryName: string;
    [key: string]: unknown;
};

export interface GetPluginListingDocumentsOutputDTO {
    data: ListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta: {
        pluginSlug: string;
        listingSlug: string;
        columns: ColumnDef[];
    };
};
