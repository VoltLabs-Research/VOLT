import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ListUserTeamsInputDTO, ListUserTeamsOutputDTO } from '@modules/team/application/dtos/team/ListUserTeamsDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class ListUserTeamsUseCase implements IUseCase<ListUserTeamsInputDTO, ListUserTeamsOutputDTO[], ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository
    ){}

    async execute(input: ListUserTeamsInputDTO): Promise<Result<ListUserTeamsOutputDTO[], ApplicationError>>{
        const { userId } = input;
        const userTeams = await this.teamRepository.findUserTeams(userId);
        return Result.ok(userTeams);
    }
}
