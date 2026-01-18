import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { HasAccessInputDTO } from '@modules/team/application/dtos/team/HasAccessDTO';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';

@injectable()
export default class HasAccessUseCase implements IUseCase<HasAccessInputDTO, boolean, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ){}

    async execute(input: HasAccessInputDTO): Promise<Result<boolean, ApplicationError>>{
        const { userId, teamId } = input;
        const result = await this.teamRepository.hasAccess(userId, teamId);
        return Result.ok(result);
    }
}