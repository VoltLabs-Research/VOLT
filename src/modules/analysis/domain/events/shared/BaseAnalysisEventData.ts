export interface BaseAnalysisEventData {
    analysisId: string;
    jobId: string;
    name: string;
    teamId: string;
    timestep?: number;
    trajectoryId?: string;
    trajectoryName?: string;
}
