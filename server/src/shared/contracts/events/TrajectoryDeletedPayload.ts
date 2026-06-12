/**
 * Neutral payload contract for the `trajectory.deleted` domain event.
 *
 * Moved here (re-exported from the original
 * `@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent`)
 * because the `jobs` module consumes this payload TYPE for its maintenance
 * service and should not have to import `@modules/trajectory`. The event CLASS
 * stays in the trajectory module. Pure type — no runtime footprint.
 */
export interface TrajectoryDeletedEventPayload {
    trajectoryId: string;
    teamId: string;
    storageClusterId?: string;
    userId: string;
    trajectoryName: string;
    analysisIds?: string[];
    analysisComputeClusterIds?: string[];
}
