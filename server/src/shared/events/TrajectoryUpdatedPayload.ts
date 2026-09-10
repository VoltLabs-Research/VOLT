
import type { TrajectoryStats } from '@volt/contracts/modules/trajectory/domain';
import type {
    TrajectoryStatus,
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
