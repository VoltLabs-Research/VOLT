import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import TrajectoryCloneJob, { TrajectoryCloneJobProps, TrajectoryCloneJobState } from '@modules/trajectory/entities/trajectory/TrajectoryCloneJob';
import trajectoryCloneJobMapper from '@modules/trajectory/mappers/trajectory/TrajectoryCloneJobMapper';
import TrajectoryCloneJobModel, { TrajectoryCloneJobDocument } from '@modules/trajectory/models/trajectory/TrajectoryCloneJobModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseClaimableJobRepository } from '@shared/infrastructure/persistence/mongo/MongooseClaimableJobRepository';

import type { ITrajectoryCloneJobRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryCloneJobRepository';


const OPEN_CLONE_JOB_STATES: TrajectoryCloneJobState[] = [
    'queued',
    'preparing',
    'copying'
];

@Singleton(TRAJECTORY_TOKENS.TrajectoryCloneJobRepository)
export default class TrajectoryCloneJobRepository
    extends MongooseClaimableJobRepository<TrajectoryCloneJob, TrajectoryCloneJobProps, TrajectoryCloneJobDocument>
    implements ITrajectoryCloneJobRepository {

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
