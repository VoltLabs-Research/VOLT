import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import logger from '@shared/infrastructure/logger';

interface IdentifiableEntity {
    readonly _id: string;
};

interface IterableRepository<T extends IdentifiableEntity> {
    export(options: { filter: Record<string, string>; select?: string[] }): Promise<T[]>;
};

const getPayloadValue = (payload: unknown, key: string): string => {
    if (!isRecord(payload) || typeof payload[key] !== 'string') {
        throw new Error(`Event payload is missing string field: ${key}`);
    }

    return payload[key];
};

const runWithConcurrency = async <T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number
): Promise<void> => {
    let cursor = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (cursor < tasks.length) {
            const index = cursor++;
            await tasks[index]();
        }
    });
    await Promise.all(workers);
};

export abstract class CascadeDeleteEachOnEntityDeletedHandler<
    TEvent extends IDomainEvent,
    TEntity extends IdentifiableEntity
> implements IEventHandler<TEvent> {

    protected abstract readonly repository: IterableRepository<TEntity>;
    protected abstract readonly payloadKey: string;
    protected abstract readonly filterField: string;
    protected abstract deleteOne(id: string, event: TEvent): Promise<void>;
    protected readonly concurrency: number = 8;

    async handle(event: TEvent): Promise<void> {
        const value = getPayloadValue(event.payload, this.payloadKey);
        const entities = await this.repository.export({
            filter: { [this.filterField]: value },
            select: ['_id']
        });

        if (entities.length === 0) {
            return;
        }

        const tasks = entities.map((entity) => async () => {
            try {
                await this.deleteOne(entity._id, event);
            } catch (error) {
                logger.warn(
                    { err: error, handler: this.constructor.name, id: entity._id, event: event.name },
                    `@cascade-delete: failed to delete child ${entity._id}`
                );
            }
        });

        await runWithConcurrency(tasks, this.concurrency);
    }
};
