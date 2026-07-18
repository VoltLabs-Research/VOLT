import ApplicationError from '@shared/application/errors/ApplicationError';

type Executor<TService, TInput, TOutput> = (service: TService, input: TInput) => Promise<TOutput>;

/**
 * Runs a trajectory service call, normalising failures onto thrown
 * ApplicationErrors: an ApplicationError propagates unchanged, any other throw
 * becomes ApplicationError.internalServerError. Use-cases delegate here so they
 * never leak raw exceptions to callers (the public-canvas wrappers rely on this).
 */
export const runTrajectoryService = async <TService, TInput, TOutput>(
    service: TService,
    input: TInput,
    executeService: Executor<TService, TInput, TOutput>
): Promise<TOutput> => {
    try {
        return await executeService(service, input);
    } catch (error: unknown) {
        if (error instanceof ApplicationError) {
            throw error;
        }

        throw ApplicationError.internalServerError('Failed to process trajectory service request');
    }
};
