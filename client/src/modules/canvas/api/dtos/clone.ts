export interface CloneTrajectoryInput {
    sourceTrajectoryId: string;
    targetClusterId?: string;
}

export interface CloneTrajectoryOutput {
    trajectoryId: string;
    jobId: string;
    sourceTrajectoryId: string;
    destinationClusterId: string;
}
