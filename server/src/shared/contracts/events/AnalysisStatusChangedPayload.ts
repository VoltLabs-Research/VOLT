/**
 * Neutral payload contract for the `analysis.status.changed` domain event.
 *
 * Moved here (re-exported from the original
 * `@modules/analysis/domain/events/AnalysisStatusChangedEvent`) so cross-module
 * consumers (cluster, plugin) reference the payload TYPE without importing
 * `@modules/analysis`. The event CLASS stays in the analysis module. The entity
 * sub-types come from the already-neutral `@shared/contracts/types/AnalysisProps`.
 * `status` mirrors the analysis-entity `status` prop (a `string`). Pure type.
 */
import type {
    AnalysisArtifactStatus,
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
