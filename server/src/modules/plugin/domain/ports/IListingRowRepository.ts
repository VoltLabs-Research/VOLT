import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import ListingRow, { ListingRowProps } from '@modules/plugin/domain/entities/ListingRow';

export interface IListingRowRepository extends IBaseRepository<ListingRow, ListingRowProps>{

};