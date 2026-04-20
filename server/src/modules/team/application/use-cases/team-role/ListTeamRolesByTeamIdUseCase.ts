import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO } from '@modules/team/application/dtos/team-role/ListTeamRolesByTeamIdDTO';
import type TeamRole from '@modules/team/domain/entities/team-role/TeamRole';
import type { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';

interface TeamRoleFilter {
    team: string;
};

@injectable()
export default class ListTeamRolesByTeamIdUseCase implements IUseCase<ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly repository: ITeamRoleRepository
    ) {}

    async execute(input: ListTeamRolesByTeamIdInputDTO): Promise<Result<ListTeamRolesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page, limit } = input;
        const filter: TeamRoleFilter = { team: teamId };

        const results = await this.repository.findAll({
            filter,
            page,
            limit
        });
        return Result.ok({
            ...results,
            data: results.data.map((entity: TeamRole) => toPersistedOutput(entity))
        });
    }
};
