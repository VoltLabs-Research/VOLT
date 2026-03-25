import { TrajectoryDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import Trajectory, { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export default createMongoMapper<Trajectory, TrajectoryProps, TrajectoryDocument>(Trajectory, [
    'createdBy',
    'team',
    'folder',
    'storageClusterId'
]);
