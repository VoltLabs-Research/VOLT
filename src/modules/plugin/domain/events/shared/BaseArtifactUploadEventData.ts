export interface BaseArtifactUploadEventData {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
}
