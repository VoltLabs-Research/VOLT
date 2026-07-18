import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { ListUserTeamsInputDTO, ListUserTeamsOutputDTO } from '@modules/team/dtos/team/ListUserTeamsDTO';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class ListUserTeamsUseCase implements IUseCase<ListUserTeamsInputDTO, ListUserTeamsOutputDTO[]>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository
    ){}

    async execute(input: ListUserTeamsInputDTO): Promise<ListUserTeamsOutputDTO[]>{
        const { userId } = input;
        const userTeams = await this.teamRepository.findUserTeams(userId);
        return userTeams;
    }
}
