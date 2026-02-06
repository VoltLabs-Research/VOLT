import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { Resource } from '@core/constants/resources';
import { Action } from '@core/constants/permissions';
import { CheckInvitePermissionInputDTO, CheckInvitePermissionOutputDTO } from '@modules/team/application/dtos/team/CheckInvitePermissionDTO';

@injectable()
export default class CheckInvitePermissionUseCase implements IUseCase<CheckInvitePermissionInputDTO, CheckInvitePermissionOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository
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

        const permissions: string[] = member.props.role?.permissions ?? [];
        const requiredPermission = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;

        const canInvite = permissions.includes('*') || permissions.includes(requiredPermission);

        return Result.ok({ canInvite });
    }
}
