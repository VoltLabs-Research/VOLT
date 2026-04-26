import StoragePlacement, { StoragePlacementProps } from '@modules/cluster/domain/entities/StoragePlacement';
import { StoragePlacementDocument } from '@modules/cluster/infrastructure/persistence/mongo/models/StoragePlacementModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<StoragePlacement, StoragePlacementProps, StoragePlacementDocument>(StoragePlacement, [
    'team'
]);
