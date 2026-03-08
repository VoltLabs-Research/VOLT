import SubListingRow, { SubListingRowProps } from '@modules/plugin/domain/entities/listing-row/SubListingRow';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/listing-row/ISubListingRowRepository';
import SubListingRowModel, { SubListingRowDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/listing-row/SubListingRowModel';
import subListingRowMapper from '@modules/plugin/infrastructure/persistence/mongo/mappers/listing-row/SubListingRowMapper';

import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class SubListingRowRepository
    extends MongooseBaseRepository<SubListingRow, SubListingRowProps, SubListingRowDocument>
    implements ISubListingRowRepository {

    constructor() {
        super(SubListingRowModel, subListingRowMapper);
    }
};
