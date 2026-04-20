export interface CloneTrajectoryInputDTO {
    teamId: string;
    userId: string;
    sourceTrajectoryId: string;
    targetClusterId?: string;
};

export interface CloneTrajectoryOutputDTO {
    trajectoryId: string;
    jobId: string;
    sourceTrajectoryId: string;
    destinationClusterId: string;
};
