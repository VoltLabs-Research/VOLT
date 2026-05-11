import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type {
    AnalysisArtifactStatus,
    AnalysisChildAnalysis,
    AnalysisExpectedArtifact,
    AnalysisStage
} from '@modules/analysis/domain/entities/Analysis';

export interface AnalysisStageChangedEventPayload {
    analysisId: string;
    trajectoryId: string;
    teamId: string;
    artifactStatus?: AnalysisArtifactStatus;
    expectedArtifacts?: AnalysisExpectedArtifact[];
    stages?: AnalysisStage[];
    childAnalyses?: AnalysisChildAnalysis[];
}

export default class AnalysisStageChangedEvent extends BaseDomainEvent<AnalysisStageChangedEventPayload> {
    constructor(payload: AnalysisStageChangedEventPayload) {
        super('analysis.stage.changed', payload);
    }
}
