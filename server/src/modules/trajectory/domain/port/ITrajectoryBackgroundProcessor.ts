export interface ProcessorContext {
    workingDir: string;
}

export interface TrajectoryUploadFile {
    path: string;
    size: number;
    originalname?: string;
}

export interface ITrajectoryBackgroundProcessor {
    process(trajectoryId: string, files: TrajectoryUploadFile[], teamId: string): Promise<void>;
}
