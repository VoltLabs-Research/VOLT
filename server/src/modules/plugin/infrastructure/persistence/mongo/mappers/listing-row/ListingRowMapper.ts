import ListingRow, { ListingRowProps } from '@modules/plugin/domain/entities/listing-row/ListingRow';
import { ListingRowDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/listing-row/ListingRowModel';

import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<ListingRow, ListingRowProps, ListingRowDocument>(ListingRow, [
    'plugin',
    'team',
    'analysis',
    'trajectory'
]);
