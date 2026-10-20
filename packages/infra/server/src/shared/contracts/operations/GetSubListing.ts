import type { GetSubListingInput as WireGetSubListingInput } from '@volt/contracts/modules/plugin/ai-tools';
import type { SubListingColumn, SubListingRowData } from '@volt/contracts/modules/plugin/listing';

export type GetSubListingInput = WireGetSubListingInput & { teamId: string };

export interface GetSubListingOutput {
    subListingName: string;
    columns: SubListingColumn[];
    rows: SubListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}
