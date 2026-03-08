import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';

interface TeamJobActionInput {
    teamId: string;
}

export default abstract class BaseTeamJobActionUseCase<TInput extends TeamJobActionInput, TOutput> implements IUseCase<TInput, TOutput, ApplicationError> {
    protected abstract run(teamId: string): Promise<TOutput>;

    async execute(input: TInput): Promise<Result<TOutput, ApplicationError>> {
        const result = await this.run(input.teamId);
        return Result.ok(result);
    }
}
