import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import TrajectoryCloneJob, { TrajectoryCloneJobProps, TrajectoryCloneJobState } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import trajectoryCloneJobMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/trajectory/TrajectoryCloneJobMapper';
import TrajectoryCloneJobModel, { TrajectoryCloneJobDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryCloneJobModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseClaimableJobRepository } from '@shared/infrastructure/persistence/mongo/MongooseClaimableJobRepository';


const OPEN_CLONE_JOB_STATES: TrajectoryCloneJobState[] = [
    'queued',
    'preparing',
    'copying'
];

@Singleton(TRAJECTORY_TOKENS.TrajectoryCloneJobRepository)
export default class TrajectoryCloneJobRepository
    extends MongooseClaimableJobRepository<TrajectoryCloneJob, TrajectoryCloneJobProps, TrajectoryCloneJobDocument> {

    constructor() {
        super(TrajectoryCloneJobModel, trajectoryCloneJobMapper, OPEN_CLONE_JOB_STATES);
    }

    async findOpenByDestinationTrajectoryId(trajectoryId: string): Promise<TrajectoryCloneJob | null> {
        const document = await this.model.findOne({
            destinationTrajectoryId: trajectoryId,
            state: { $in: OPEN_CLONE_JOB_STATES }
        }).sort({ createdAt: -1 }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

}
