import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteTeamMemberByIdInputDTO } from '@modules/team/application/dtos/team-member/DeleteTeamMemberByIdDTO';
import { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamMemberDeletedEvent from '@modules/team/domain/events/TeamMemberDeletedEvent';

@injectable()
export default class DeleteTeamMemberByIdUseCase implements IUseCase<DeleteTeamMemberByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteTeamMemberByIdInputDTO): Promise<Result<null, ApplicationError>>{
        const { teamMemberId, teamId } = input;
        const teamMember = await this.teamMemberRepository.deleteById(teamMemberId);
        if(!teamMember){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        await this.eventBus.publish(new TeamMemberDeletedEvent({
            teamMemberId,
            teamId
        }));

        return Result.ok(null);
    }
};