export interface BaseArtifactUploadEventData {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
}
