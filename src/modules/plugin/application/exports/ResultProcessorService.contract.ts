import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@/modules/analysis/contracts/http.analysis';
import type { ArtifactUploadBatch } from '@/modules/plugin/application/artifacts/ArtifactUploadQueueService';

export interface ResultProcessorService {
    processExposureResult(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        outputDir: string,
        timestep: number,
        teamId: string,
        artifactUploadBatch: ArtifactUploadBatch
    ): Promise<void>;
}
