import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';
import { GetMyTeamPermissionsInputDTO, GetMyTeamPermissionsOutputDTO } from '@modules/team/application/dtos/team/GetMyTeamPermissionsDTO';
import type { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';
import { getTeamMemberRolePermissions, isPopulatedTeamMemberRole } from '@modules/team/domain/entities/team-member/TeamMember';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetMyTeamPermissionsUseCase implements IUseCase<GetMyTeamPermissionsInputDTO, GetMyTeamPermissionsOutputDTO, ApplicationError> {
    constructor(
        
        private readonly teamMemberRepository: TeamMemberRepository
    ) {}

    private getPermissions(memberRole: TeamMemberProps['role']): string[] {
        if (isPopulatedTeamMemberRole(memberRole) && memberRole.isSystem && memberRole.name) {
            switch (memberRole.name) {
                case SystemRoleNames.OWNER:
                    return SystemRoles[SystemRoleNames.OWNER].permissions;
                case SystemRoleNames.ADMIN:
                    return SystemRoles[SystemRoleNames.ADMIN].permissions;
                case SystemRoleNames.MEMBER:
                    return SystemRoles[SystemRoleNames.MEMBER].permissions;
                case SystemRoleNames.VIEWER:
                    return SystemRoles[SystemRoleNames.VIEWER].permissions;
                default:
                    break;
            }
        }

        return getTeamMemberRolePermissions(memberRole);
    }

    async execute(input: GetMyTeamPermissionsInputDTO): Promise<Result<GetMyTeamPermissionsOutputDTO, ApplicationError>> {
        const { teamId, userId } = input;

        const member = await this.teamMemberRepository.findOne(
            { team: teamId, user: userId },
            { populate: ['role'] }
        );

        if (!member) {
            return Result.ok({ permissions: [] });
        }

        const rolePermissions = this.getPermissions(member.props.role);
        const permissions = Array.from(new Set(rolePermissions));

        return Result.ok({ permissions });
    }
};
