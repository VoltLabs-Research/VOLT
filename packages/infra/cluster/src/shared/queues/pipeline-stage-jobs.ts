import type { PipelinePlannedStage } from '@shared/contracts/types/http-analysis';

// The queue holds one pipeline job per frame; the server tracks each analysis stage of it
// as its own job, `<pipeline job>:<analysis id>`.
export interface PipelineStageJobRef {
    pipelineJobId: string;
    analysisId: string;
}

export const toPipelineStageJobId = (pipelineJobId: string, analysisId: string): string =>
    `${pipelineJobId}:${analysisId}`;

export const parsePipelineStageJobId = (jobId: string): PipelineStageJobRef | null => {
    if (!jobId.startsWith('pipeline-')) return null;

    const separator = jobId.indexOf(':');
    if (separator <= 0 || separator === jobId.length - 1) return null;

    return {
        pipelineJobId: jobId.slice(0, separator),
        analysisId: jobId.slice(separator + 1)
    };
};

export const isComputeStage = (stage: PipelinePlannedStage): stage is PipelinePlannedStage & { analysisId: string } =>
    stage.kind === 'plugin' && !stage.cacheHit && typeof stage.analysisId === 'string';

export const listComputeStageAnalysisIds = (stages: readonly PipelinePlannedStage[]): string[] =>
    stages.filter(isComputeStage).map((stage) => stage.analysisId);
