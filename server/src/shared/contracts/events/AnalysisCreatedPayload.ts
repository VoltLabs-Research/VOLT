/**
 * Neutral payload contract for the `analysis.created` domain event.
 *
 * Moved here (re-exported from the original
 * `@modules/analysis/events/AnalysisCreatedEvent`) so cross-module
 * consumers (cluster, plugin) reference the payload TYPE without importing
 * `@modules/analysis`. The event CLASS stays in the analysis module. The entity
 * sub-types come from the already-neutral `@shared/contracts/types/AnalysisProps`.
 * Pure type — no runtime footprint.
 */
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
