import { TrajectoryDocument } from '@modules/trajectory/models/trajectory/TrajectoryModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import Trajectory, { TrajectoryProps } from '@modules/trajectory/entities/trajectory/Trajectory';

export default createMongoMapper<Trajectory, TrajectoryProps, TrajectoryDocument>(Trajectory, [
    'createdBy',
    'team',
    'folder',
    'storageClusterId'
]);
