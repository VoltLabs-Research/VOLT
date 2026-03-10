import SubListingRow, { SubListingRowProps } from '@modules/plugin/domain/entities/listing-row/SubListingRow';
import { SubListingRowDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/listing-row/SubListingRowModel';

import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<SubListingRow, SubListingRowProps, SubListingRowDocument>(SubListingRow, [
    'plugin',
    'team',
    'analysis',
    'trajectory'
]);
