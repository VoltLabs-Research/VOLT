/**
 * Neutral payload contract for the `analysis.stage.changed` domain event.
 *
 * Moved here (re-exported from the original
 * `@modules/analysis/events/AnalysisStageChangedEvent`) so cross-module
 * consumers (cluster, plugin) reference the payload TYPE without importing
 * `@modules/analysis`. The event CLASS stays in the analysis module. The entity
 * sub-types come from the already-neutral `@shared/contracts/types/AnalysisProps`.
 * Pure type — no runtime footprint.
 */
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
