
export interface TrajectoryDeletedEventPayload {
    trajectoryId: string;
    teamId: string;
    storageClusterId?: string;
    userId: string;
    trajectoryName: string;
    analysisIds?: string[];
    analysisComputeClusterIds?: string[];
}
