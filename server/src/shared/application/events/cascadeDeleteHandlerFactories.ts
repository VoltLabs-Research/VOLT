import { container, injectable } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';

import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { DeleteManyOnTrajectoryDeletedHandler } from '@shared/application/events/DeleteManyOnTrajectoryDeletedHandler';

interface DeletableRepository {
    deleteMany(filter: Record<string, string>): Promise<number>;
};

interface HandlerFactoryOptions {
    /**
     * Optional override for the filter field used in the repository query.
     * Defaults to the base class value (`team`, `user`, `trajectory`).
     */
    filterField?: string;
    /**
     * Optional override for the generated class `name` so that logs and
     * tsyringe diagnostics remain readable (pre-refactor behaviour).
     */
    className?: string;
};

const assignClassName = (cls: Function, name: string): void => {
    Object.defineProperty(cls, 'name', { value: name, configurable: true });
};

/**
 * Builds an ad-hoc `@injectable()` handler that extends
 * `DeleteManyOnTeamDeletedHandler` and resolves its repository from the
 * provided token at construction time. Use instead of hand-written wrappers
 * in per-module `application/events/*` files.
 */
export const deleteManyOnTeamDeletedHandler = (
    repositoryToken: InjectionToken<DeletableRepository>,
    options: HandlerFactoryOptions = {}
): new () => DeleteManyOnTeamDeletedHandler => {
    @injectable()
    class GeneratedTeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
        protected readonly repository: DeletableRepository;

        constructor() {
            super();
            this.repository = container.resolve<DeletableRepository>(repositoryToken);
            if (options.filterField) {
                (this as unknown as { filterField: string }).filterField = options.filterField;
            }
        }
    };

    assignClassName(GeneratedTeamDeletedEventHandler, options.className ?? 'TeamDeletedEventHandler');

    return GeneratedTeamDeletedEventHandler;
};

/**
 * Builds an ad-hoc `@injectable()` handler that extends
 * `DeleteManyOnUserDeletedHandler`.
 */
export const deleteManyOnUserDeletedHandler = (
    repositoryToken: InjectionToken<DeletableRepository>,
    options: HandlerFactoryOptions = {}
): new () => DeleteManyOnUserDeletedHandler => {
    @injectable()
    class GeneratedUserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
        protected readonly repository: DeletableRepository;

        constructor() {
            super();
            this.repository = container.resolve<DeletableRepository>(repositoryToken);
            if (options.filterField) {
                (this as unknown as { filterField: string }).filterField = options.filterField;
            }
        }
    };

    assignClassName(GeneratedUserDeletedEventHandler, options.className ?? 'UserDeletedEventHandler');

    return GeneratedUserDeletedEventHandler;
};

/**
 * Builds an ad-hoc `@injectable()` handler that extends
 * `DeleteManyOnTrajectoryDeletedHandler`.
 */
export const deleteManyOnTrajectoryDeletedHandler = (
    repositoryToken: InjectionToken<DeletableRepository>,
    options: HandlerFactoryOptions = {}
): new () => DeleteManyOnTrajectoryDeletedHandler => {
    @injectable()
    class GeneratedTrajectoryDeletedEventHandler extends DeleteManyOnTrajectoryDeletedHandler {
        protected readonly repository: DeletableRepository;

        constructor() {
            super();
            this.repository = container.resolve<DeletableRepository>(repositoryToken);
            if (options.filterField) {
                (this as unknown as { filterField: string }).filterField = options.filterField;
            }
        }
    };

    assignClassName(GeneratedTrajectoryDeletedEventHandler, options.className ?? 'TrajectoryDeletedEventHandler');

    return GeneratedTrajectoryDeletedEventHandler;
};
