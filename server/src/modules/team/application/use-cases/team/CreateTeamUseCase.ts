import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import { CreateTeamInputDTO, CreateTeamOutputDTO } from '@modules/team/application/dtos/team/CreateTeamDTO';
import TeamRole from '@modules/team/domain/entities/team-role/TeamRole';
import TeamCreatedEvent from '@modules/team/domain/events/team/TeamCreatedEvent';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateTeamUseCase implements IUseCase<CreateTeamInputDTO, CreateTeamOutputDTO, ApplicationError> {
    constructor(
        
        private readonly teamRepository: TeamRepository,

        
        private readonly teamRoleRepository: TeamRoleRepository,

        
        private readonly teamMemberRepository: TeamMemberRepository,

        
        private readonly userRepository: UserRepository,

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

        const ownerRoleDefinition = SystemRoles[SystemRoleNames.OWNER];
        const ownerRole = await this.teamRoleRepository.create(TeamRole.create({
            teamId: team._id,
            name: ownerRoleDefinition.name,
            permissions: ownerRoleDefinition.permissions,
            isSystem: ownerRoleDefinition.isSystem
        }));

        const additionalSystemRoles = [
            SystemRoles[SystemRoleNames.ADMIN],
            SystemRoles[SystemRoleNames.MEMBER],
            SystemRoles[SystemRoleNames.VIEWER]
        ];

        for (const roleDefinition of additionalSystemRoles) {
            await this.teamRoleRepository.create(TeamRole.create({
                teamId: team._id,
                name: roleDefinition.name,
                permissions: roleDefinition.permissions,
                isSystem: roleDefinition.isSystem
            }));
        }

        await this.teamMemberRepository.create({
            user: userId,
            team: team._id,
            role: ownerRole._id,
            createdAt: new Date(),
            joinedAt: new Date(),
            updatedAt: new Date()
        });

        await this.userRepository.addTeamToUser(userId, team._id);

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
