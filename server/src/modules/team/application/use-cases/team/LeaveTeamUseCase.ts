import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import { LeaveTeamInputDTO } from '../../dtos/team/LeaveTeamDTO';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamMemberLeaveEvent from '@modules/team/domain/events/TeamMemberLeaveEvent';

@injectable()
export default class LeaveTeamUseCase implements IUseCase<LeaveTeamInputDTO, null, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: LeaveTeamInputDTO): Promise<Result<null, ApplicationError>> {
        const { teamId, userId } = input;

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const member = await this.teamMemberRepository.findOne({ user: userId, team: teamId });
        if (!member) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_USER_NOT_MEMBER,
                'You are not a member of this team'
            ));
        }

        await this.eventBus.publish(new TeamMemberLeaveEvent({
            memberId: member.id,
            teamId
        }));

        return Result.ok(null);
    }
}
