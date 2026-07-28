import type {
    SceneArtifactBatchUpsertedEventPayload,
    TrajectoryDeletedEventPayload,
    TrajectoryUpdatedEventPayload
} from '@shared/contracts/events';
import type { TrajectoryCreatedEventPayload } from '@modules/trajectory/events/trajectory/TrajectoryCreatedEvent';

declare global {
    interface EventMap {
        'trajectory.created': TrajectoryCreatedEventPayload;
        'trajectory.deleted': TrajectoryDeletedEventPayload;
        'trajectory.updated': TrajectoryUpdatedEventPayload;
        'scene-artifact.upserted': SceneArtifactBatchUpsertedEventPayload;
    }
}
