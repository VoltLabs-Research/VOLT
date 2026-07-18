
import type {
    AnalysisArtifactStatus,
    AnalysisConfig,
    AnalysisExpectedArtifact
} from '@shared/contracts/types/AnalysisProps';

export interface AnalysisCreatedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    config: AnalysisConfig;
    status: string;
    artifactStatus?: AnalysisArtifactStatus;
    expectedArtifacts?: AnalysisExpectedArtifact[];
    createdAt: Date;
}
