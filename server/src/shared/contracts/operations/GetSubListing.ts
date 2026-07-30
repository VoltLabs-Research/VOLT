
export interface GetSubListingInput {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    teamId: string;
    page?: number;
    limit?: number;
}

export type { SubListingColumn, SubListingRowData } from '@volt/contracts/modules/plugin/listing';
import type { SubListingColumn, SubListingRowData } from '@volt/contracts/modules/plugin/listing';

export interface GetSubListingOutput {
    subListingName: string;
    columns: SubListingColumn[];
    rows: SubListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}
