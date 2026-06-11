import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import TrajectoryUploadSessionModel from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryUploadSessionModel';

import type {
    CreateTrajectoryUploadSessionInput,
    TrajectoryUploadSession,
    TrajectoryUploadSessionStatus
} from '@modules/trajectory/domain/contracts/trajectory/UploadSession';
import type { ITrajectoryUploadSessionRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryUploadSessionRepository';

// `CreateTrajectoryUploadSessionInput` now lives in the domain contract; this
// re-export preserves the historical import path for any infra-side consumers.
export type { CreateTrajectoryUploadSessionInput } from '@modules/trajectory/domain/contracts/trajectory/UploadSession';

@Singleton(TRAJECTORY_TOKENS.TrajectoryUploadSessionRepository)
export default class TrajectoryUploadSessionRepository implements ITrajectoryUploadSessionRepository {
    // The hydrated Mongoose document is a structural superset of the plain
    // domain projection (its `.id` getter is the hex string `_id`), so casting
    // at this ODM seam keeps the repository speaking the domain contract
    // without a hand-written mapper. A dedicated entity + mapper (like
    // `Trajectory`) would remove the cast — see module notes.
    async create(input: CreateTrajectoryUploadSessionInput): Promise<TrajectoryUploadSession> {
        return (await TrajectoryUploadSessionModel.create(input)) as unknown as TrajectoryUploadSession;
    }

    async findById(id: string): Promise<TrajectoryUploadSession | null> {
        return (await TrajectoryUploadSessionModel.findById(id).exec()) as unknown as TrajectoryUploadSession | null;
    }

    async markStatus(
        id: string,
        status: TrajectoryUploadSessionStatus,
        extra: Partial<Pick<TrajectoryUploadSession, 'committedAt'>> = {}
    ): Promise<void> {
        await TrajectoryUploadSessionModel.findByIdAndUpdate(id, {
            status,
            ...extra
        }).exec();
    }
}
