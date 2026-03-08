import { type ErrorCode } from '@core/constants/error-codes';
import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import { TrajectoryStatus, TrajectoryStats, TrajectoryFrame } from '@modules/trajectory/domain/entities/Trajectory';

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
