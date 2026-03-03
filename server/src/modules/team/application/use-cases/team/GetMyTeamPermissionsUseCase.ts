import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/ports/Result';
import { GetMyTeamPermissionsInputDTO, GetMyTeamPermissionsOutputDTO } from '@modules/team/application/dtos/team/GetMyTeamPermissionsDTO';

@injectable()
export default class GetMyTeamPermissionsUseCase implements IUseCase<GetMyTeamPermissionsInputDTO, GetMyTeamPermissionsOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(input: GetMyTeamPermissionsInputDTO): Promise<Result<GetMyTeamPermissionsOutputDTO, ApplicationError>> {
        const { teamId, userId } = input;

        const member = await this.teamMemberRepository.findOne(
            { team: teamId, user: userId },
            { populate: ['role'] }
        );

        if (!member) {
            return Result.ok({ permissions: [] });
        }

        const rolePermissions = member.props.role?.permissions ?? [];
        const permissions = Array.from(new Set(rolePermissions));

        return Result.ok({ permissions });
    }
}
