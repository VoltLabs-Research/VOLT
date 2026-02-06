import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import ListingRow, { ListingRowProps } from '@modules/plugin/domain/entities/ListingRow';
import ListingRowModel, { ListingRowDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/ListingRowModel';
import listingRowMapper from '@modules/plugin/infrastructure/persistence/mongo/mappers/ListingRowMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class ListingRowRepository
    extends MongooseBaseRepository<ListingRow, ListingRowProps, ListingRowDocument>
    implements IListingRowRepository{

    constructor(){
        super(ListingRowModel, listingRowMapper);
    }
};