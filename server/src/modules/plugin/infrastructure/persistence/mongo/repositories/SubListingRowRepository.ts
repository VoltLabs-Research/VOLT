import { ISubListingRowRepository } from '@modules/plugin/domain/port/ISubListingRowRepository';
import SubListingRow, { SubListingRowProps } from '@modules/plugin/domain/entities/SubListingRow';
import SubListingRowModel, { SubListingRowDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/SubListingRowModel';
import subListingRowMapper from '@modules/plugin/infrastructure/persistence/mongo/mappers/SubListingRowMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class SubListingRowRepository
    extends MongooseBaseRepository<SubListingRow, SubListingRowProps, SubListingRowDocument>
    implements ISubListingRowRepository {

    constructor() {
        super(SubListingRowModel, subListingRowMapper);
    }
}
