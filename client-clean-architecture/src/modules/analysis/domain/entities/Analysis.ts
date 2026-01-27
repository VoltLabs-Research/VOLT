export interface AnalysisConfig {
    _id: string;
    name?: string;
    modifier: string;
    config: Record<string, any>;
    trajectory: any;
    createdAt: string;
    updatedAt: string;
}

export interface RetryFailedFramesResponse {
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
}
