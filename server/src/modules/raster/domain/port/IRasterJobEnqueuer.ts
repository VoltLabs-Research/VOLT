export interface IRasterJobEnqueuer {
    triggerRasterization(trajectoryId: string, teamId: string, config?: unknown): Promise<boolean>;
}
