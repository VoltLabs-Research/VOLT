export interface ProcessorContext {
    workingDir: string;
    incomingDir: string;
};

export interface TrajectoryUploadFile {
    path: string;
    size: number;
    originalname?: string;
    mimetype?: string;
};

export interface ITrajectoryBackgroundProcessor {
    process(trajectoryId: string, files: TrajectoryUploadFile[], teamId: string): Promise<void>;
};
