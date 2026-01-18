import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO } from '@modules/team/application/dtos/team-role/ListTeamRolesByTeamIdDTO';

@injectable()
export default class ListTeamRolesByTeamIdUseCase implements IUseCase<ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ) { }

    async execute(input: ListTeamRolesByTeamIdInputDTO): Promise<Result<ListTeamRolesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page, limit } = input;
        const results = await this.teamRoleRepository.findAll({ filter: { team: teamId }, page, limit });
        return Result.ok({
            ...results,
            data: results.data.map(r => r.props)
        });
    }
}