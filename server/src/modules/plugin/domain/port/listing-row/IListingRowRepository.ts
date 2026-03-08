import ListingRow, { ListingRowProps } from '@modules/plugin/domain/entities/listing-row/ListingRow';

import { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface ListingRowUpsertOperation {
    filter: Partial<ListingRowProps>;
    update: Partial<ListingRowProps>;
};

export interface IListingRowRepository extends IBaseRepository<ListingRow, ListingRowProps>{
    bulkUpsert(operations: ListingRowUpsertOperation[]): Promise<void>;
};