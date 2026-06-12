/**
 * Neutral, standalone copy of the `trajectory.updated` domain-event payload.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration). Mirrors
 * `TrajectoryUpdatedEventPayload` owned by
 * `@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent`, exported
 * here so cross-module consumers can type the event payload without importing the
 * trajectory module. The `TrajectoryStatus` / `TrajectoryStats` / `TrajectoryFrame`
 * shapes come from the neutral `@shared/contracts/types/Trajectory` copy.
 *
 * No `@modules/*` imports — pure type declarations only.
 */
import type {
    TrajectoryStatus,
    TrajectoryStats,
    TrajectoryFrame
} from '@shared/contracts/types/Trajectory';
import type { ErrorCode } from '@core/constants/error-codes';

export interface TrajectoryUpdatedEventPayload {
    trajectoryId: string;
    teamId: string;
    updates: {
        status?: TrajectoryStatus;
        stats?: Partial<TrajectoryStats>;
        frames?: TrajectoryFrame[];
        failureCode?: ErrorCode;
        failureDetails?: string;
        hasPreview?: boolean;
    };
    updatedAt: Date;
}
