import TrajectoryFolder, { type TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

export default createMongoMapper<TrajectoryFolder, TrajectoryFolderProps, CatalogFolderDocument>(
    TrajectoryFolder,
    ['team', 'createdBy', 'parent']
);
