import { container, injectable } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';

import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { DeleteManyOnTrajectoryDeletedHandler } from '@shared/application/events/DeleteManyOnTrajectoryDeletedHandler';
import { subscribeHandlerClass } from '@shared/infrastructure/events/Subscribe';
import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

interface DeletableRepository {
    deleteMany(filter: Record<string, string>): Promise<number>;
};

interface HandlerFactoryOptions {
    filterField?: string;
    className?: string;
};

type AnyCtor = abstract new (...args: any[]) => any;

const assignClassName = (cls: Function, name: string): void => {
    Object.defineProperty(cls, 'name', { value: name, configurable: true });
};

const buildCascadeHandler = (
    BaseClass: AnyCtor,
    repositoryToken: InjectionToken<DeletableRepository>,
    options: HandlerFactoryOptions,
    defaultName: string
): new () => IEventHandler<IDomainEvent> => {
    @injectable()
    class Generated extends (BaseClass as unknown as new (...args: any[]) => any) {
        protected readonly repository: DeletableRepository;

        constructor() {
            super();
            this.repository = container.resolve<DeletableRepository>(repositoryToken);
            if (options.filterField) {
                (this as unknown as { filterField: string }).filterField = options.filterField;
            }
        }
    };

    assignClassName(Generated, options.className ?? defaultName);
    return Generated as unknown as new () => IEventHandler<IDomainEvent>;
};

/**
 * Generates a `team.deleted` handler that cascades to `deleteMany` on the
 * given repository AND auto-subscribes it to the event bus. Replaces the
 * old pattern where the returned class had to be listed in a subscribers
 * manifest.
 */
export const deleteManyOnTeamDeleted = (
    repositoryToken: InjectionToken<DeletableRepository>,
    options: HandlerFactoryOptions = {}
): void => {
    subscribeHandlerClass(
        'team.deleted',
        buildCascadeHandler(DeleteManyOnTeamDeletedHandler, repositoryToken, options, 'TeamDeletedEventHandler')
    );
};

export const deleteManyOnUserDeleted = (
    repositoryToken: InjectionToken<DeletableRepository>,
    options: HandlerFactoryOptions = {}
): void => {
    subscribeHandlerClass(
        'user.deleted',
        buildCascadeHandler(DeleteManyOnUserDeletedHandler, repositoryToken, options, 'UserDeletedEventHandler')
    );
};

export const deleteManyOnTrajectoryDeleted = (
    repositoryToken: InjectionToken<DeletableRepository>,
    options: HandlerFactoryOptions = {}
): void => {
    subscribeHandlerClass(
        'trajectory.deleted',
        buildCascadeHandler(DeleteManyOnTrajectoryDeletedHandler, repositoryToken, options, 'TrajectoryDeletedEventHandler')
    );
};
