import { ITeamRepository } from "../../../domain/ports/ITeamRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { CreateTeamInputDTO, CreateTeamOutputDTO } from "../../dtos/team/CreateTeamDTO";
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import TeamCreatedEvent from '../../../domain/events/TeamCreatedEvent';

@injectable()
export default class CreateTeamUseCase implements IUseCase<CreateTeamInputDTO, CreateTeamOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTeamInputDTO): Promise<Result<CreateTeamOutputDTO, ApplicationError>> {
        const { name, description, ownerId } = input;
        const team = await this.teamRepository.create({
            name,
            description,
            owner: ownerId
        });

        await this.eventBus.publish(new TeamCreatedEvent({
            ownerId,
            teamId: team.id
        }));

        return Result.ok({
            _id: team.id,
            ...team.props
        });
    }
}