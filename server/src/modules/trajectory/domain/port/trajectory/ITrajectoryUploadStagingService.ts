import type { TrajectoryUploadFile } from './ITrajectoryBackgroundProcessor';

export interface ITrajectoryUploadStagingService {
    stageUploads(trajectoryId: string, files: TrajectoryUploadFile[]): Promise<TrajectoryUploadFile[]>;
}
