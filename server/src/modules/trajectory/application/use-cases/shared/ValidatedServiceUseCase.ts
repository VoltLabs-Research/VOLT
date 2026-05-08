import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type { IUseCase } from '@shared/application/IUseCase';

type Validator<TInput> = (input: TInput) => ApplicationError | null;
type Executor<TService, TInput, TOutput> = (service: TService, input: TInput) => Promise<TOutput>;

export abstract class ValidatedServiceUseCase<TInput, TOutput, TService>
    implements IUseCase<TInput, TOutput, ApplicationError> {
    constructor(
        protected readonly service: TService,
        private readonly validate: Validator<TInput>,
        private readonly executeService: Executor<TService, TInput, TOutput>
    ) {}

    async execute(input: TInput): Promise<Result<TOutput, ApplicationError>> {
        const validationError = this.validate(input);

        if (validationError) {
            return Result.fail(validationError);
        }

        try {
            const output = await this.executeService(this.service, input);

            return Result.ok(output);
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.internalServerError('Failed to process trajectory service request'));
        }
    }
};
