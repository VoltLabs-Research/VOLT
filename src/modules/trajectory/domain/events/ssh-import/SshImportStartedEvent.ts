import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';

export interface SshImportStartedEventData {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
}

export class SshImportStartedEvent extends BaseDomainEvent<SshImportStartedEventData> {
    static readonly eventName = 'trajectory.ssh-import.started';

    constructor(payload: SshImportStartedEventData) {
        super(SshImportStartedEvent.eventName, payload);
    }
}
