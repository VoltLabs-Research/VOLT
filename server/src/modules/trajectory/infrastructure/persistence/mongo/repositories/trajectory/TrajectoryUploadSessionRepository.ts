import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import TrajectoryUploadSessionModel from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryUploadSessionModel';

import type {
    TrajectoryUploadSessionDocument,
    TrajectoryUploadSessionFileProps,
    TrajectoryUploadSessionStatus
} from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryUploadSessionModel';

export interface CreateTrajectoryUploadSessionInput {
    team: string;
    user: string;
    ownerClusterId: string;
    bucket: string;
    resourceKind: string;
    resourceId: string;
    files: TrajectoryUploadSessionFileProps[];
    expiresAt: Date;
}

@Singleton(TRAJECTORY_TOKENS.TrajectoryUploadSessionRepository)
export default class TrajectoryUploadSessionRepository {
    async create(input: CreateTrajectoryUploadSessionInput): Promise<TrajectoryUploadSessionDocument> {
        return TrajectoryUploadSessionModel.create(input);
    }

    async findById(id: string): Promise<TrajectoryUploadSessionDocument | null> {
        return TrajectoryUploadSessionModel.findById(id).exec();
    }

    async markStatus(
        id: string,
        status: TrajectoryUploadSessionStatus,
        extra: Partial<Pick<TrajectoryUploadSessionDocument, 'committedAt'>> = {}
    ): Promise<void> {
        await TrajectoryUploadSessionModel.findByIdAndUpdate(id, {
            status,
            ...extra
        }).exec();
    }
}
