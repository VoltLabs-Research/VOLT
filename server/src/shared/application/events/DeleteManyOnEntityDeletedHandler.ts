import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { getPayloadValue } from '@shared/application/events/getPayloadValue';

interface DeletableRepository {
    deleteMany(filter: Record<string, string>): Promise<number>;
}

export abstract class DeleteManyOnEntityDeletedHandler<TEvent extends IDomainEvent>
    implements IEventHandler<TEvent> {
    protected abstract readonly repository: DeletableRepository;
    protected abstract readonly payloadKey: string;
    protected abstract readonly filterField: string;

    async handle(event: TEvent): Promise<void> {
        const value = getPayloadValue(event.payload, this.payloadKey);
        await this.repository.deleteMany({ [this.filterField]: value });
    }
}
