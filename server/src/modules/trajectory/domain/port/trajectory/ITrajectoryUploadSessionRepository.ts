import type {
    CreateTrajectoryUploadSessionInput
} from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryUploadSessionRepository';
import type {
    TrajectoryUploadSessionDocument,
    TrajectoryUploadSessionStatus
} from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryUploadSessionModel';

export interface ITrajectoryUploadSessionRepository {
    create(input: CreateTrajectoryUploadSessionInput): Promise<TrajectoryUploadSessionDocument>;
    findById(id: string): Promise<TrajectoryUploadSessionDocument | null>;
    markStatus(
        id: string,
        status: TrajectoryUploadSessionStatus,
        extra?: Partial<Pick<TrajectoryUploadSessionDocument, 'committedAt'>>
    ): Promise<void>;
}
