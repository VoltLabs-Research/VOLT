export interface ITrajectoryBackgroundProcessor {
    process(trajectoryId: string, files: any[], teamId: string): Promise<void>;
}
