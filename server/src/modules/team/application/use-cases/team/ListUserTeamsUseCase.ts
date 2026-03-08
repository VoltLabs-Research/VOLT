import { ITeamRepository } from '@modules/team/domain/port/ITeamRepository';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ListUserTeamsInputDTO, ListUserTeamsOutputDTO } from '@modules/team/application/dtos/team/ListUserTeamsDTO';

@injectable()
export default class ListUserTeamsUseCase implements IUseCase<ListUserTeamsInputDTO, ListUserTeamsOutputDTO[], ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository
    ){}
    
    async execute(input: ListUserTeamsInputDTO): Promise<Result<ListUserTeamsOutputDTO[], ApplicationError>>{
        const { userId } = input;
        const userTeams = await this.teamRepository.findUserTeams(userId);
        return Result.ok(userTeams);
    }
};