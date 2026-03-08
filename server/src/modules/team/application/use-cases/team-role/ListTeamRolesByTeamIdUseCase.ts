import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import type { ITeamRoleRepository } from '@modules/team/domain/port/ITeamRoleRepository';
import type TeamRole from '@modules/team/domain/entities/TeamRole';
import type {
    ListTeamRolesByTeamIdInputDTO,
    ListTeamRolesByTeamIdOutputDTO
} from '@modules/team/application/dtos/team-role/ListTeamRolesByTeamIdDTO';

@injectable()
export default class ListTeamRolesByTeamIdUseCase implements IUseCase<ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly repository: ITeamRoleRepository
    ) {}

    async execute(input: ListTeamRolesByTeamIdInputDTO): Promise<Result<ListTeamRolesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page, limit } = input;
        const results = await this.repository.findAll({
            filter: { team: teamId },
            page,
            limit
        });
        return Result.ok({
            ...results,
            data: results.data.map((entity: TeamRole) => toPersistedOutput(entity))
        });
    }
}
