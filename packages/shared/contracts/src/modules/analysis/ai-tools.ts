import type { tags } from 'typia';

export interface AnalysisRefInput{
    analysisId: string;
}

export interface ListAnalysesInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
    search?: string;
}

export interface ListTrajectoryAnalysesInput{
    trajectoryId: string;
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
}

export interface ListAnalysesByConfigInput{
    trajectoryId: string;
    configFilter?: { [key: string]: unknown };
    status?: string;
}

export interface GetAnalysisFrameLogInput{
    analysisId: string;
    timestep: number;
    afterCursor?: string;
}

export interface CompareAnalysesInput{
    analysisIdA: string;
    analysisIdB: string;
}

export interface DeleteAnalysisInput{
    analysisId: string;
    reason?: string;
}
