import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { ListingRow } from '@/modules/plugin/api/entities/listing-row';

export interface GetPluginListingInputDTO {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
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
