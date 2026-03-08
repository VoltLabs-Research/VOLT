import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { CreateTeamInputDTO, CreateTeamOutputDTO } from '@modules/team/application/dtos/team/CreateTeamDTO';
import TeamCreatedEvent from '@modules/team/domain/events/team/TeamCreatedEvent';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class CreateTeamUseCase implements IUseCase<CreateTeamInputDTO, CreateTeamOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTeamInputDTO): Promise<Result<CreateTeamOutputDTO, ApplicationError>> {
        const { name, description, userId } = input;
        const team = await this.teamRepository.create({
            name,
            description,
            owner: userId
        });

        await this.eventBus.publish(new TeamCreatedEvent({
            ownerId: userId,
            teamId: team._id
        }));

        return Result.ok({
            _id: team._id,
            ...team.props
        });
    }
};
