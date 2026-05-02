import { TrajectoryStatus, TrajectoryStats, TrajectoryFrame } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

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
    };
    updatedAt: Date;
}

export default class TrajectoryUpdatedEvent extends BaseDomainEvent<TrajectoryUpdatedEventPayload> {
    constructor(payload: TrajectoryUpdatedEventPayload) {
        super('trajectory.updated', payload);
    }
}
