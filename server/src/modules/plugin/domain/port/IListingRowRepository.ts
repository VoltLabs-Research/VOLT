import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import ListingRow, { ListingRowProps } from '@modules/plugin/domain/entities/ListingRow';

export interface IListingRowRepository extends IBaseRepository<ListingRow, ListingRowProps>{

};