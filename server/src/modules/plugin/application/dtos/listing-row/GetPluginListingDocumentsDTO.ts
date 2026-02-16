export interface GetPluginListingDocumentsInputDTO {
    pluginSlug: string;
    listingSlug?: string;
    exposureId?: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
};

export interface ExportPluginListingDocumentsInputDTO {
    pluginSlug: string;
    exposureId: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    listingSlug?: string;
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
        exposureId: string;
        columns: ColumnDef[];
    };
};

export interface ExportPluginListingDocumentsOutputDTO {
    meta: {
        pluginSlug: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        total: number;
    };
    data: ListingRowData[];
};
