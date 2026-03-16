import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { CreateTeamInputDTO, CreateTeamOutputDTO } from '@modules/team/application/dtos/team/CreateTeamDTO';
import TeamCreatedEvent from '@modules/team/domain/events/team/TeamCreatedEvent';
import TeamRole from '@modules/team/domain/entities/team-role/TeamRole';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import type { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
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

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,

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
