/**
 * Neutral payload contract for the `analysis.deleted` domain event.
 *
 * Moved here (re-exported from the original
 * `@modules/analysis/events/AnalysisDeletedEvent`) because the `jobs`
 * module consumes this payload TYPE for its maintenance/projection services and
 * should not have to import `@modules/analysis`. The event CLASS stays in the
 * analysis module. Pure type — no runtime footprint.
 */
export interface AnalysisDeletedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    teamId: string;
    teamClusterId?: string;
    storageClusterId?: string;
    computeClusterId?: string;
    userId: string;
    pluginDisplayName: string;
}
