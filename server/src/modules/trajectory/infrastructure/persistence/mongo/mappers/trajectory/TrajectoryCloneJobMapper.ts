import TrajectoryCloneJob, { TrajectoryCloneJobProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import { TrajectoryCloneJobDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryCloneJobModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TrajectoryCloneJob, TrajectoryCloneJobProps, TrajectoryCloneJobDocument>(TrajectoryCloneJob, [
    'team'
]);
