export interface TrajectoryJobEventData {
    jobId: string;
    teamId: string;
    trajectoryId: string;
}

export interface TimedTrajectoryJobEventData extends TrajectoryJobEventData {
    timestep?: number;
}
