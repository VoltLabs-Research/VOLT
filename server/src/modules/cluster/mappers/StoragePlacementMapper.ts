import StoragePlacement, { StoragePlacementProps } from '@modules/cluster/entities/StoragePlacement';
import { StoragePlacementDocument } from '@modules/cluster/models/StoragePlacementModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<StoragePlacement, StoragePlacementProps, StoragePlacementDocument>(StoragePlacement, [
    'team'
]);
