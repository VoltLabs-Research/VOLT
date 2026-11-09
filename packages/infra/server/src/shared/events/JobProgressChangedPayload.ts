// What a running analysis job's plugin last said about how far it is, relayed from its cluster.
export interface JobProgressChangedEventPayload {
    jobId: string;
    teamId: string;
    teamClusterId: string;
    analysisId: string;
    // 0..1 once the plugin reported a value.
    progress?: number;
    progressText?: string;
}
