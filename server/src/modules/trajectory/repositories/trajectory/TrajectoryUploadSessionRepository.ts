import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import TrajectoryUploadSessionModel from '@modules/trajectory/models/trajectory/TrajectoryUploadSessionModel';

import type {
    CreateTrajectoryUploadSessionInput,
    TrajectoryUploadSession,
    TrajectoryUploadSessionStatus
} from '@modules/trajectory/contracts/trajectory/UploadSession';
import type { ITrajectoryUploadSessionRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryUploadSessionRepository';

export type { CreateTrajectoryUploadSessionInput } from '@modules/trajectory/contracts/trajectory/UploadSession';

@Singleton(TRAJECTORY_TOKENS.TrajectoryUploadSessionRepository)
export default class TrajectoryUploadSessionRepository implements ITrajectoryUploadSessionRepository {
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
