import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@/modules/analysis/contracts/http-analysis';
import type { AnalysisStageReporter } from '@/modules/analysis/application/workflow/AnalysisStageReporter';
import type { ArtifactUploadBatch } from '@/modules/plugin/contracts/artifact-upload';

export interface ResultProcessorService {
    processExposureResult(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        outputDir: string,
        timestep: number,
        teamId: string,
        artifactUploadBatch: ArtifactUploadBatch,
        stageReporter?: AnalysisStageReporter
    ): Promise<void>;
}
