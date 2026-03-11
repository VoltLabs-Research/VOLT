import TrajectoryFolder, { type TrajectoryFolderProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryFolder';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { TrajectoryFolderDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryFolderModel';

export default createMongoMapper<TrajectoryFolder, TrajectoryFolderProps, TrajectoryFolderDocument>(
    TrajectoryFolder,
    ['team', 'createdBy', 'parent']
);
