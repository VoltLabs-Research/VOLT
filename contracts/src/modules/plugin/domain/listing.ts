import type { BaseEntity } from '../../../shared/base';

export interface ListingColumnDef{
    key?: string;
    label: string;
    title?: string;
    sortable: boolean;
    width?: number;
}

export interface ListingRow extends BaseEntity{
    trajectoryId?: string;
    trajectoryName?: string;
    analysisId?: string;
    exposureId?: string;
    timestep?: number;
    [key: string]: unknown;
}

export interface ListingRowData{
    _id: string;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    exposureId: string;
    trajectoryName: string;
    [key: string]: unknown;
}

export interface ListingRowByAnalysisData{
    _id: string;
    plugin: string;
    exposureId: string;
    exposureName: string;
    trajectory: string;
    trajectoryName: string;
    timestep: number;
    row: Record<string, unknown>;
}

export interface SubListingColumn{
    label: string;
    sortable: boolean;
}

export interface SubListingRowData{
    _id: string;
    [key: string]: unknown;
}

export interface AnalysisListingExportOption{
    id: string;
    listingId: string;
    listingName: string;
    label: string;
}

export interface AnalysisSubListingExportOption{
    id: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    label: string;
}

export interface GetAnalysisListingExportOptionsResponse{
    analysisId: string;
    hasConfig: boolean;
    listings: AnalysisListingExportOption[];
    subListings: AnalysisSubListingExportOption[];
}
