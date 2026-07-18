import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { CheckInvitePermissionInputDTO, CheckInvitePermissionOutputDTO } from '@modules/team/dtos/team/CheckInvitePermissionDTO';
import { getTeamMemberRolePermissions } from '@modules/team/entities/team-member/TeamMember';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CheckInvitePermissionUseCase implements IUseCase<CheckInvitePermissionInputDTO, CheckInvitePermissionOutputDTO>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository
    ){}

    async execute(input: CheckInvitePermissionInputDTO): Promise<CheckInvitePermissionOutputDTO>{
        const { teamId, userId } = input;

        const member = await this.teamMemberRepository.findOne(
            { team: teamId, user: userId },
            { populate: ['role'] }
        );

        if(!member){
            return { canInvite: false };
        }

        const permissions = getTeamMemberRolePermissions(member.props.role);
        const requiredPermission = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;

        const canInvite = permissions.includes('*') || permissions.includes(requiredPermission);

        return { canInvite };
    }
}
