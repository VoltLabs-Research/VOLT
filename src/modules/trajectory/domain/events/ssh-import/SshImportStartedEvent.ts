import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { TrajectoryJobEventData } from '@/modules/trajectory/domain/events/shared/trajectory-job-event-data';

export type SshImportStartedEventData = TrajectoryJobEventData;

export class SshImportStartedEvent extends BaseDomainEvent<SshImportStartedEventData> {
    static readonly eventName = 'trajectory.ssh-import.started';

    constructor(payload: SshImportStartedEventData) {
        super(SshImportStartedEvent.eventName, payload);
    }
}
