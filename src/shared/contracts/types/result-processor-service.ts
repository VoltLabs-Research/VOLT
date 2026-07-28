import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@shared/contracts/types/http-analysis';
import type { AnalysisStageReporter } from '@modules/analysis/services/workflow/AnalysisStageReporter';
import type { ArtifactUploadBatch } from '@shared/contracts/types/artifact-upload';

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
