import SubListingRow, { SubListingRowProps } from '@modules/plugin/domain/entities/SubListingRow';
import { SubListingRowDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/SubListingRowModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class SubListingRowMapper extends BaseMapper<SubListingRow, SubListingRowProps, SubListingRowDocument> {
    constructor() {
        super(SubListingRow, [
            'plugin',
            'team',
            'analysis',
            'trajectory'
        ]);
    }
}

export default new SubListingRowMapper();
