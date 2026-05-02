import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

interface DeletableRepository {
    deleteMany(filter: Record<string, string>): Promise<number>;
}

const getPayloadValue = (payload: unknown, key: string): string => {
    if (!isRecord(payload) || typeof payload[key] !== 'string') {
        throw new Error(`Event payload is missing string field: ${key}`);
    }

    return payload[key];
};

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
