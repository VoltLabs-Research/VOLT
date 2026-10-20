export interface JobIdentity {
    jobId: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    pluginId?: string;
    timestep?: number;
}

export type Failed<T> = T & { error: string };
