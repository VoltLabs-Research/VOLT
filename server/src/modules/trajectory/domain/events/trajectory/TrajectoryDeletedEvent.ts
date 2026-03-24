import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface TrajectoryDeletedEventPayload {
    trajectoryId: string;
    teamId: string;
    teamCluster?: string;
    storageClusterId?: string;
    userId: string;
    trajectoryName: string;
};

export default class TrajectoryDeletedEvent extends BaseDomainEvent<TrajectoryDeletedEventPayload> {
    constructor(payload: TrajectoryDeletedEventPayload) {
        super('trajectory.deleted', payload);
    }
};
