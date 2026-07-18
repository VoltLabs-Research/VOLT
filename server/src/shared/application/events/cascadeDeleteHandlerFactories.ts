import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { DeleteManyOnTrajectoryDeletedHandler } from '@shared/application/events/DeleteManyOnTrajectoryDeletedHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

interface DeletableRepository {
    deleteMany(filter: Record<string, string>): Promise<number>;
}

interface HandlerFactoryOptions {
    filterField?: string;
    className?: string;
}

type AnyCtor = abstract new (...args: any[]) => any;

const buildCascadeHandler = (
    BaseClass: AnyCtor,
    repository: DeletableRepository,
    options: HandlerFactoryOptions
): IEventHandler<IDomainEvent> => {
    class Generated extends (BaseClass as unknown as new () => any) {
        protected readonly repository = repository;
    }

    if (options.className) {
        Object.defineProperty(Generated, 'name', { value: options.className, configurable: true });
    }

    const instance = new Generated();
    if (options.filterField) {
        (instance as unknown as { filterField: string }).filterField = options.filterField;
    }
    return instance as unknown as IEventHandler<IDomainEvent>;
};

export const deleteManyOnTeamDeleted = (repository: DeletableRepository, options: HandlerFactoryOptions = {}): void => {
    subscribeHandler('team.deleted', buildCascadeHandler(DeleteManyOnTeamDeletedHandler, repository, options));
};

export const deleteManyOnUserDeleted = (repository: DeletableRepository, options: HandlerFactoryOptions = {}): void => {
    subscribeHandler('user.deleted', buildCascadeHandler(DeleteManyOnUserDeletedHandler, repository, options));
};

export const deleteManyOnTrajectoryDeleted = (repository: DeletableRepository, options: HandlerFactoryOptions = {}): void => {
    subscribeHandler('trajectory.deleted', buildCascadeHandler(DeleteManyOnTrajectoryDeletedHandler, repository, options));
};
