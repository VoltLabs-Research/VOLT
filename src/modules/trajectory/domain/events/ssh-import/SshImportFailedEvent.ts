import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { SshImportStartedEventData } from '@/modules/trajectory/domain/events/ssh-import/SshImportStartedEvent';

export interface SshImportFailedEventData extends SshImportStartedEventData {
    error: string;
}

export class SshImportFailedEvent extends BaseDomainEvent<SshImportFailedEventData> {
    static readonly eventName = 'trajectory.ssh-import.failed';

    constructor(payload: SshImportFailedEventData) {
        super(SshImportFailedEvent.eventName, payload);
    }
}
