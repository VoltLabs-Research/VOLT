import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import ListingRow, { ListingRowProps } from '@modules/plugin/domain/entities/ListingRow';

export interface ListingRowUpsertOperation {
    filter: Partial<ListingRowProps>;
    update: Partial<ListingRowProps>;
}

export interface IListingRowRepository extends IBaseRepository<ListingRow, ListingRowProps>{
    bulkUpsert(operations: ListingRowUpsertOperation[]): Promise<void>;
};