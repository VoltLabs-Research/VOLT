// Wire response types for the analysis module — the shapes the client reads
// back from `data`. `_id`, refs and dates are strings on the wire. Analyses are
// large aggregates owned by the compute/analysis pipeline; the list/detail
// payloads are passed through as structural records.

/** An analysis as the client sees it in list/detail responses. */
export type PersistedAnalysis = Record<string, unknown> & {
    _id: string;
};

export interface RetryFailedFramesResponse{
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
}

/** One page of a frame's execution-log segments. */
export interface AnalysisFrameLogResponse{
    analysisId: string;
    timestep: number;
    status: string;
    segments: unknown[];
    nextCursor?: string;
    [key: string]: unknown;
}

/** A provenance record as the client sees it. */
export type ProvenanceRecord = Record<string, unknown>;

export interface ProvenanceQueryResponse{
    records: ProvenanceRecord[];
}

export interface ProvenanceReproduceResponse{
    command: string;
    provenanceId: string;
}
