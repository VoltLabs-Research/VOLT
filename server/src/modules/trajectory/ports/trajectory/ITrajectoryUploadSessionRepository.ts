import type {
    CreateTrajectoryUploadSessionInput,
    TrajectoryUploadSession,
    TrajectoryUploadSessionStatus
} from '@modules/trajectory/contracts/trajectory/UploadSession';

export interface ITrajectoryUploadSessionRepository {
    create(input: CreateTrajectoryUploadSessionInput): Promise<TrajectoryUploadSession>;
    findById(id: string): Promise<TrajectoryUploadSession | null>;
    markStatus(
        id: string,
        status: TrajectoryUploadSessionStatus,
        extra?: Partial<Pick<TrajectoryUploadSession, 'committedAt'>>
    ): Promise<void>;
}
