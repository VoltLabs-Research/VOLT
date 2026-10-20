
import type { AnalysisArtifactStatus } from '@volt/contracts/modules/analysis/domain';
import type {
    AnalysisChildAnalysis,
    AnalysisExpectedArtifact,
    AnalysisStage,
    AnalysisProps
} from '@shared/contracts/types/AnalysisProps';

export interface AnalysisStatusChangedEventPayload {
    analysisId: string;
    trajectoryId: string;
    teamId: string;
    status: AnalysisProps['status'];
    totalFrames?: number;
    failedFrames?: number;
    artifactStatus?: AnalysisArtifactStatus;
    expectedArtifacts?: AnalysisExpectedArtifact[];
    stages?: AnalysisStage[];
    childAnalyses?: AnalysisChildAnalysis[];
}
