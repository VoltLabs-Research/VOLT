

export type PersistedAnalysis = Record<string, unknown> & {
    _id: string;
};

export interface RetryFailedFramesResponse{
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
}

export interface AnalysisFrameLogResponse{
    analysisId: string;
    timestep: number;
    status: string;
    segments: unknown[];
    nextCursor?: string;
    [key: string]: unknown;
}

export type ProvenanceRecord = Record<string, unknown>;

export interface ProvenanceQueryResponse{
    records: ProvenanceRecord[];
}

export interface ProvenanceReproduceResponse{
    command: string;
    provenanceId: string;
}
