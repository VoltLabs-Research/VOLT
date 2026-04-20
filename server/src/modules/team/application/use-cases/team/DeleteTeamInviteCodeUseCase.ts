import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { DeleteTeamInviteCodeInputDTO, DeleteTeamInviteCodeOutputDTO } from '@modules/team/application/dtos/team/DeleteTeamInviteCodeDTO';
import { getTeamMemberRolePermissions } from '@modules/team/domain/entities/team-member/TeamMember';
import { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class DeleteTeamInviteCodeUseCase implements IUseCase<DeleteTeamInviteCodeInputDTO, DeleteTeamInviteCodeOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(input: DeleteTeamInviteCodeInputDTO): Promise<Result<DeleteTeamInviteCodeOutputDTO, ApplicationError>> {
        const { teamId, userId } = input;

        const member = await this.teamMemberRepository.findOne(
            { team: teamId, user: userId },
            { populate: ['role'] }
        );

        if (!member) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS,
                'You do not have permission to manage invite codes'
            ));
        }

        const permissions = getTeamMemberRolePermissions(member.props.role);
        const requiredPermission = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;
        const canManage = permissions.includes('*') || permissions.includes(requiredPermission);

        if (!canManage) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS,
                'You do not have permission to manage invite codes'
            ));
        }

        await this.teamRepository.clearInviteCode(teamId);

        return Result.ok({ message: 'Invite code deleted successfully' });
    }
};
