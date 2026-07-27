import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { getPayloadValue } from '@shared/application/events/getPayloadValue';

interface DeletableCollection {
    deleteMany(filter: Record<string, string>): PromiseLike<{ deletedCount?: number }>;
}

export abstract class DeleteManyOnEntityDeletedHandler<TEvent extends IDomainEvent>
    implements IEventHandler<TEvent> {
    protected abstract readonly repository: DeletableCollection;
    protected abstract readonly payloadKey: string;
    protected abstract readonly filterField: string;

    async handle(event: TEvent): Promise<void> {
        const value = getPayloadValue(event.payload, this.payloadKey);
        await this.repository.deleteMany({ [this.filterField]: value });
    }
}
