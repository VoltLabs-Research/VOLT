import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { CheckInvitePermissionInputDTO, CheckInvitePermissionOutputDTO } from '@modules/team/application/dtos/team/CheckInvitePermissionDTO';
import { getTeamMemberRolePermissions } from '@modules/team/domain/entities/team-member/TeamMember';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class CheckInvitePermissionUseCase implements IUseCase<CheckInvitePermissionInputDTO, CheckInvitePermissionOutputDTO, ApplicationError>{
    constructor(
        private teamMemberRepository: TeamMemberRepository
    ){}

    async execute(input: CheckInvitePermissionInputDTO): Promise<Result<CheckInvitePermissionOutputDTO, ApplicationError>>{
        const { teamId, userId } = input;

        const member = await this.teamMemberRepository.findOne(
            { team: teamId, user: userId },
            { populate: ['role'] }
        );

        if(!member){
            return Result.ok({ canInvite: false });
        }

        const permissions = getTeamMemberRolePermissions(member.props.role);
        const requiredPermission = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;

        const canInvite = permissions.includes('*') || permissions.includes(requiredPermission);

        return Result.ok({ canInvite });
    }
}
