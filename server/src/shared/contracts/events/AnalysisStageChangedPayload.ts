
import type {
    AnalysisArtifactStatus,
    AnalysisChildAnalysis,
    AnalysisExpectedArtifact,
    AnalysisStage
} from '@shared/contracts/types/AnalysisProps';

export interface AnalysisStageChangedEventPayload {
    analysisId: string;
    trajectoryId: string;
    teamId: string;
    artifactStatus?: AnalysisArtifactStatus;
    expectedArtifacts?: AnalysisExpectedArtifact[];
    stages?: AnalysisStage[];
    childAnalyses?: AnalysisChildAnalysis[];
}
