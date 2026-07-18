import TrajectoryCloneJob, { TrajectoryCloneJobProps } from '@modules/trajectory/entities/trajectory/TrajectoryCloneJob';
import { TrajectoryCloneJobDocument } from '@modules/trajectory/models/trajectory/TrajectoryCloneJobModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TrajectoryCloneJob, TrajectoryCloneJobProps, TrajectoryCloneJobDocument>(TrajectoryCloneJob, [
    'team'
]);
