import { BaseController } from './BaseController';
import { PaginatedBaseController } from './PaginatedBaseController';
import {
    buildControllerParams,
    wrapHandleWithValidation
} from './controller-internals';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { Result } from '@shared/domain/port/Result';
import { toPersistedOutput, type PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { container, injectable } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { ValidationSchemaInput } from '@shared/infrastructure/http/middleware/validation';
import type { IUseCase } from '@shared/application/IUseCase';
import type {
    IBaseRepository,
    PaginatedResult,
    PopulatePath,
    RepositoryFilter
} from '@shared/domain/port/IBaseRepository';
import type { ErrorCode } from '@core/constants/error-codes';

/**
 * High-level helpers that eliminate the UseCase + DTO + Controller triple for
 * plain read endpoints (findById / findAll by filter).
 *
 * Both helpers return an @injectable() class compatible with the standard
 * routing convention: `router.get('/:id', container.resolve(Controller).handle)`.
 *
 * Internally they synthesize a tiny IUseCase adapter that calls the repository
 * directly, so they plug into the existing BaseController / PaginatedBaseController
 * pipeline (validation, request context, error normalization) without bypassing it.
 *
 * ----------------------------------------------------------------------------
 * Usage — `simulation-cell/GetSimulationCellByIdController.ts` becomes:
 *
 *     export default createGetByIdController({
 *         repositoryToken: SimulationCellRepository,
 *         paramKey: 'simulationCellId',
 *         populate: { path: 'trajectory', select: ['name'] },
 *         notFoundCode: ErrorCodes.SIMULATION_CELL_NOT_FOUND,
 *         notFoundMessage: 'SimulationCell not found',
 *         validationSchema: simulationCellValidationSchemas.getById
 *     });
 *
 * Usage — `simulation-cell/ListSimulationCellsByTeamIdController.ts` becomes:
 *
 *     export default createListByController({
 *         repositoryToken: SimulationCellRepository,
 *         paginated: true,
 *         populate: { path: 'trajectory', select: ['name'] },
 *         validationSchema: simulationCellValidationSchemas.listByTeamId,
 *         filterBuilder: (params) => {
 *             const filter: Record<string, unknown> = { team: params.teamId };
 *             if (params.trajectoryId) filter.trajectory = params.trajectoryId;
 *             if (params.timestep !== undefined) filter.timestep = params.timestep;
 *             return filter;
 *         }
 *     });
 * ----------------------------------------------------------------------------
 */

type PopulateInput = string | string[] | PopulatePath | PopulatePath[];

type ReadControllerParams = Record<string, unknown>;

type RepositoryLike<TEntity, TProps> = IBaseRepository<TEntity, TProps>;

type EntityWithProps<TProps> = { props: TProps };

type ReadUseCase<TOutput> = IUseCase<ReadControllerParams, TOutput, ApplicationError>;

// ---------------------------------------------------------------------------
// Shared utilities live in `controller-internals.ts` so this factory and
// `createController.ts` stay in lockstep.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET by id
// ---------------------------------------------------------------------------

export interface CreateGetByIdControllerOptions<TEntity extends EntityWithProps<TProps>, TProps> {
    /** DI token resolving to a repository that implements IBaseRepository. */
    repositoryToken: InjectionToken<RepositoryLike<TEntity, TProps>>;
    /** Name of the express param that holds the entity id (e.g. 'simulationCellId'). */
    paramKey: string;
    /** Error code returned when the entity is not found. Prefer an ErrorCodes.* constant. */
    notFoundCode: ErrorCode | string;
    /** Human-readable message paired with notFoundCode. Defaults to '<paramKey> not found'. */
    notFoundMessage?: string;
    /** Optional populate passed through to repository.findById. */
    populate?: PopulateInput;
    /** Optional projection passed through to repository.findById. */
    select?: string[];
    /** Zod schema (or {body,query,params} map) attached to the controller's validation pipeline. */
    validationSchema?: ValidationSchemaInput;
};

export const createGetByIdController = <TProps, TEntity extends EntityWithProps<TProps>>(
    options: CreateGetByIdControllerOptions<TEntity, TProps>
) => {
    const {
        repositoryToken,
        paramKey,
        notFoundCode,
        notFoundMessage,
        populate,
        select,
        validationSchema
    } = options;

    type Output = PersistedOutput<TProps>;

    @injectable()
    class GeneratedGetByIdController extends BaseController<ReadUseCase<Output>> {
        constructor() {
            const repository = container.resolve<RepositoryLike<TEntity, TProps>>(repositoryToken);

            const useCase: ReadUseCase<Output> = {
                async execute(input) {
                    const id = input[paramKey];

                    if (typeof id !== 'string' || id.length === 0) {
                        return Result.fail(ApplicationError.badRequest(
                            notFoundCode,
                            notFoundMessage ?? `${paramKey} is required`
                        ));
                    }

                    const entity = await repository.findById(id, { populate, select });

                    if (!entity) {
                        return Result.fail(ApplicationError.notFound(
                            notFoundCode,
                            notFoundMessage ?? `${paramKey} not found`
                        ));
                    }

                    return Result.ok(toPersistedOutput<TProps>(entity));
                }
            };

            super(useCase, HttpStatus.OK);

            this.handle = wrapHandleWithValidation(this.handle, validationSchema);
        }

        protected override getParams(req: AuthenticatedRequest): ReadControllerParams {
            return buildControllerParams(req, this.getValidatedRequestData(req)) as ReadControllerParams;
        }
    };

    return GeneratedGetByIdController;
};

// ---------------------------------------------------------------------------
// LIST by filter (paginated or flat)
// ---------------------------------------------------------------------------

/**
 * Build a mongo-like filter from the controller params (merged validated
 * params + query + body + auth metadata — see buildControllerParams).
 */
export type ReadFilterBuilder<TProps> = (
    params: ReadControllerParams
) => RepositoryFilter<TProps>;

interface CreateListByControllerBaseOptions<TEntity extends EntityWithProps<TProps>, TProps> {
    repositoryToken: InjectionToken<RepositoryLike<TEntity, TProps>>;
    filterBuilder: ReadFilterBuilder<TProps>;
    populate?: PopulateInput;
    select?: string[];
    sort?: Record<string, 1 | -1>;
    validationSchema?: ValidationSchemaInput;
};

export interface CreatePaginatedListByControllerOptions<TEntity extends EntityWithProps<TProps>, TProps>
    extends CreateListByControllerBaseOptions<TEntity, TProps> {
    paginated: true;
    /** Fallback page size when the request omits `limit`. Defaults to 10. */
    defaultLimit?: number;
    /** Fallback page number when the request omits `page`. Defaults to 1. */
    defaultPage?: number;
};

export interface CreateFlatListByControllerOptions<TEntity extends EntityWithProps<TProps>, TProps>
    extends CreateListByControllerBaseOptions<TEntity, TProps> {
    paginated: false;
    /** Optional hard cap on the number of returned rows (maps to FindOptions.limit). */
    defaultLimit?: number;
};

export type CreateListByControllerOptions<TEntity extends EntityWithProps<TProps>, TProps> =
    | CreatePaginatedListByControllerOptions<TEntity, TProps>
    | CreateFlatListByControllerOptions<TEntity, TProps>;

const coercePositiveInt = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }

    if (typeof value === 'string' && value.length > 0) {
        const parsed = Number.parseInt(value, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return fallback;
};

export function createListByController<TProps, TEntity extends EntityWithProps<TProps>>(
    options: CreatePaginatedListByControllerOptions<TEntity, TProps>
): ReturnType<typeof buildPaginatedListController<TProps, TEntity>>;
export function createListByController<TProps, TEntity extends EntityWithProps<TProps>>(
    options: CreateFlatListByControllerOptions<TEntity, TProps>
): ReturnType<typeof buildFlatListController<TProps, TEntity>>;
export function createListByController<TProps, TEntity extends EntityWithProps<TProps>>(
    options: CreateListByControllerOptions<TEntity, TProps>
) {
    if (options.paginated) {
        return buildPaginatedListController(options);
    }

    return buildFlatListController(options);
};

const buildPaginatedListController = <TProps, TEntity extends EntityWithProps<TProps>>(
    options: CreatePaginatedListByControllerOptions<TEntity, TProps>
) => {
    const {
        repositoryToken,
        filterBuilder,
        populate,
        select,
        sort,
        validationSchema,
        defaultLimit = 10,
        defaultPage = 1
    } = options;

    type Item = PersistedOutput<TProps>;
    type Output = PaginatedResult<Item>;

    @injectable()
    class GeneratedPaginatedListController extends PaginatedBaseController<ReadUseCase<Output>> {
        constructor() {
            const repository = container.resolve<RepositoryLike<TEntity, TProps>>(repositoryToken);

            const useCase: ReadUseCase<Output> = {
                async execute(input) {
                    const filter = filterBuilder(input);
                    const page = coercePositiveInt(input.page, defaultPage);
                    const limit = coercePositiveInt(input.limit, defaultLimit);

                    const result = await repository.findAll({
                        filter,
                        populate,
                        select,
                        sort,
                        page,
                        limit
                    });

                    return Result.ok({
                        ...result,
                        data: result.data.map((entity) => toPersistedOutput<TProps>(entity))
                    });
                }
            };

            super(useCase);

            this.handle = wrapHandleWithValidation(this.handle, validationSchema);
        }

        protected override getParams(req: AuthenticatedRequest): ReadControllerParams {
            return buildControllerParams(req, this.getValidatedRequestData(req)) as ReadControllerParams;
        }
    };

    return GeneratedPaginatedListController;
};

const buildFlatListController = <TProps, TEntity extends EntityWithProps<TProps>>(
    options: CreateFlatListByControllerOptions<TEntity, TProps>
) => {
    const {
        repositoryToken,
        filterBuilder,
        populate,
        select,
        sort,
        validationSchema,
        defaultLimit
    } = options;

    type Item = PersistedOutput<TProps>;
    type Output = Item[];

    @injectable()
    class GeneratedFlatListController extends BaseController<ReadUseCase<Output>> {
        constructor() {
            const repository = container.resolve<RepositoryLike<TEntity, TProps>>(repositoryToken);

            const useCase: ReadUseCase<Output> = {
                async execute(input) {
                    const filter = filterBuilder(input);

                    // IBaseRepository has no `findMany`; `export` is the canonical
                    // non-paginated read path and honours filter/populate/select/sort.
                    const entities = await repository.export({
                        filter,
                        populate,
                        select,
                        sort
                    });

                    const limited = typeof defaultLimit === 'number'
                        ? entities.slice(0, defaultLimit)
                        : entities;

                    return Result.ok(limited.map((entity) => toPersistedOutput<TProps>(entity)));
                }
            };

            super(useCase, HttpStatus.OK);

            this.handle = wrapHandleWithValidation(this.handle, validationSchema);
        }

        protected override getParams(req: AuthenticatedRequest): ReadControllerParams {
            return buildControllerParams(req, this.getValidatedRequestData(req)) as ReadControllerParams;
        }

        protected override handleSuccess(
            _req: AuthenticatedRequest,
            res: Response,
            value: Output
        ): void {
            BaseResponse.success(res, value, HttpStatus.OK);
        }
    };

    return GeneratedFlatListController;
};
