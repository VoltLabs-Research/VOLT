import ListingRow, { ListingRowProps } from '@modules/plugin/domain/entities/listing-row/ListingRow';
import { ListingRowDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/listing-row/ListingRowModel';

import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class ListingRowMapper extends BaseMapper<ListingRow, ListingRowProps, ListingRowDocument>{
    constructor(){
        super(ListingRow, [
            'plugin',
            'team',
            'analysis',
            'trajectory'
        ]);
    }
};

export default new ListingRowMapper();