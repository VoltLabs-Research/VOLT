
import type { AnalysisArtifactStatus } from '@volt/contracts/modules/analysis/domain';
import type {
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
