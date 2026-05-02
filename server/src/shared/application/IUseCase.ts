import type { Result } from '@shared/domain/port/Result';

export interface IUseCase<TInput, TOutput, TError = Error> {
    execute(input: TInput): Promise<Result<TOutput, TError>>;
}

export type UseCaseInput<TUseCase extends IUseCase<unknown, unknown, unknown>> =
    TUseCase extends IUseCase<infer TInput, unknown, unknown>
        ? TInput
        : never;

export type UseCaseOutput<TUseCase extends IUseCase<unknown, unknown, unknown>> =
    TUseCase extends IUseCase<unknown, infer TOutput, unknown>
        ? TOutput
        : never;

export type UseCaseError<TUseCase extends IUseCase<unknown, unknown, unknown>> =
    TUseCase extends IUseCase<unknown, unknown, infer TError>
        ? TError
        : never;

export type UseCaseInstance = IUseCase<unknown, unknown, unknown>;
