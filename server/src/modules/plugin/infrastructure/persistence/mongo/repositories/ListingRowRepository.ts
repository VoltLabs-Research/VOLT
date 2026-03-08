import { IListingRowRepository, ListingRowUpsertOperation } from '@modules/plugin/domain/port/IListingRowRepository';
import ListingRow, { ListingRowProps } from '@modules/plugin/domain/entities/ListingRow';
import ListingRowModel, { ListingRowDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/ListingRowModel';
import listingRowMapper from '@modules/plugin/infrastructure/persistence/mongo/mappers/ListingRowMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';
import type { AnyBulkWriteOperation } from 'mongoose';

@injectable()
export default class ListingRowRepository
    extends MongooseBaseRepository<ListingRow, ListingRowProps, ListingRowDocument>
    implements IListingRowRepository{

    constructor(){
        super(ListingRowModel, listingRowMapper);
    }

    async bulkUpsert(operations: ListingRowUpsertOperation[]): Promise<void> {
        if (operations.length === 0) return;
        const bulkOps = operations.map((operation) => ({
            updateOne: {
                filter: operation.filter,
                update: { $set: operation.update },
                upsert: true
            }
        })) as AnyBulkWriteOperation<ListingRowDocument>[];
        await this.model.bulkWrite(bulkOps);
    }
};
