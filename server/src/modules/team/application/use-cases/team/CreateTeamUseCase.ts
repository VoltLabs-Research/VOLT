import type { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import { AUTH_CONTRACT_TOKENS } from '@shared/contracts/tokens/AuthTokens';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';
import { CreateTeamInputDTO, CreateTeamOutputDTO } from '@modules/team/application/dtos/team/CreateTeamDTO';
import TeamRole from '@modules/team/domain/entities/team-role/TeamRole';
import TeamCreatedEvent from '@modules/team/domain/events/team/TeamCreatedEvent';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateTeamUseCase implements IUseCase<CreateTeamInputDTO, CreateTeamOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(AUTH_CONTRACT_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTeamInputDTO): Promise<CreateTeamOutputDTO> {
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

        return {
            _id: team._id,
            ...team.props
        };
    }
}
