import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { SshImportStartedEventData } from '@/modules/trajectory/domain/events/ssh-import/SshImportStartedEvent';

export interface SshImportCompletedEventData extends SshImportStartedEventData {}

export class SshImportCompletedEvent extends BaseDomainEvent<SshImportCompletedEventData> {
    static readonly eventName = 'trajectory.ssh-import.completed';

    constructor(payload: SshImportCompletedEventData) {
        super(SshImportCompletedEvent.eventName, payload);
    }
}
