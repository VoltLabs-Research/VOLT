export interface AnalysisJobMetadata {
    analysisId?: string;
    timestep?: number;
    [key: string]: unknown;
};

export interface AnalysisJobSummary {
    jobId: string;
    teamId: string;
    queueType: string;
    status: string;
    sessionId?: string;
    message?: string;
    metadata?: AnalysisJobMetadata;
    analysisId?: string;
    timestep?: number;
};

export interface IAnalysisTeamJobsQueryService {
    getFlatTeamJobs(teamId: string): Promise<AnalysisJobSummary[]>;
};
