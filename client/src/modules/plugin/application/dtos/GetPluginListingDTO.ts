import type { ListingRow } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { ExportType } from '@/shared/domain/export/types';

export interface GetPluginListingInputDTO {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
};

export interface ExportPluginListingInputDTO {
    pluginId: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureName?: string;
    format: ExportType;
};

export interface ExportListingByAnalysisInputDTO {
    analysisId: string;
    format: ExportType;
};

export interface GetPluginListingOutputDTO extends PaginatedResponse<ListingRow> {
    _meta?: {
        pluginId: string;
        exposureName: string;
        exposureId: string;
        columns: ColumnConfig[];
        subListingNames: string[];
    };
};

export interface GetSubListingInputDTO {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    page?: number;
    limit?: number;
};

export interface SubListingColumn {
    label: string;
    sortable: boolean;
};

export interface GetSubListingOutputDTO {
    subListingName: string;
    columns: SubListingColumn[];
    rows: Record<string, unknown>[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};

export type ExportPluginListingOutputDTO = Blob;
export type ExportListingByAnalysisOutputDTO = Blob;
