import type { SceneArtifactBatchUpsertedEventPayload } from '@shared/contracts/events/SceneArtifactBatchUpsertedPayload';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events/TrajectoryDeletedPayload';
import type { TrajectoryUpdatedEventPayload } from '@shared/contracts/events/TrajectoryUpdatedPayload';
import type { TrajectoryCreatedEventPayload } from '@modules/trajectory/contracts/events';

declare global {
    interface EventMap {
        'trajectory.created': TrajectoryCreatedEventPayload;
        'trajectory.deleted': TrajectoryDeletedEventPayload;
        'trajectory.updated': TrajectoryUpdatedEventPayload;
        'scene-artifact.upserted': SceneArtifactBatchUpsertedEventPayload;
    }
}
