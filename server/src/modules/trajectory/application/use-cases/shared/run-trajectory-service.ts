import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

type Executor<TService, TInput, TOutput> = (service: TService, input: TInput) => Promise<TOutput>;

/**
 * Runs a trajectory service call and maps the outcome onto the IUseCase Result
 * contract: success → Result.ok, a thrown ApplicationError → Result.fail(error),
 * any other throw → Result.fail(internalServerError). Use-cases delegate here so
 * they never leak raw exceptions to callers (the public-canvas wrappers rely on
 * this — they re-throw only non-ApplicationError).
 */
export const runTrajectoryService = async <TService, TInput, TOutput>(
    service: TService,
    input: TInput,
    executeService: Executor<TService, TInput, TOutput>
): Promise<Result<TOutput, ApplicationError>> => {
    try {
        const output = await executeService(service, input);

        return Result.ok(output);
    } catch (error: unknown) {
        if (error instanceof ApplicationError) {
            return Result.fail(error);
        }

        return Result.fail(ApplicationError.internalServerError('Failed to process trajectory service request'));
    }
};
