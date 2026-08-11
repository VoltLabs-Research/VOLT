import type { GetSubListingInput as WireGetSubListingInput } from '@volt/contracts/modules/plugin/ai-tools';
import type { SubListingColumn, SubListingRowData } from '@volt/contracts/modules/plugin/listing';

/**
 * The wire input plus the team scope the server resolves from the request.
 *
 * An intersection rather than a second field list: restating the fields is how the
 * two definitions drift.
 */
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
