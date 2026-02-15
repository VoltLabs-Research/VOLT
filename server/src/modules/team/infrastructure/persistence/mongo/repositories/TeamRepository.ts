import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import Team, { TeamProps } from '@modules/team/domain/entities/Team';
import TeamModel, { TeamDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamModel';
import teamMapper from '@modules/team/infrastructure/persistence/mongo/mappers/TeamMapper';
import { injectable, inject } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class TeamRepository
    extends MongooseBaseRepository<Team, TeamProps, TeamDocument>
    implements ITeamRepository {

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ) {
        super(TeamModel, teamMapper);
    }

    async addMemberToTeam(memberId: string, teamId: string): Promise<void> {
        // TODO: TeamModel schema has no 'members' array field. Membership is tracked
        // via the TeamMember collection. This method should delegate to TeamMemberRepository
        // instead of performing a $push on a non-existent field.
        logger.warn(`addMemberToTeam: no-op — TeamModel has no 'members' field (memberId=${memberId}, teamId=${teamId})`);
    }

    async addRoleToTeam(roleId: string, teamId: string): Promise<void> {
        // TODO: TeamModel schema has no 'roles' array field. Roles are tracked
        // via the TeamRole collection with a 'team' reference. This $push is a no-op
        // against the current schema and should be removed or replaced with proper logic.
        logger.warn(`addRoleToTeam: no-op — TeamModel has no 'roles' field (roleId=${roleId}, teamId=${teamId})`);
    }

    async removeUserFromAllTeams(userId: string): Promise<void> {
        // Remove TeamMember records using repository
        await this.teamMemberRepository.deleteByUserId(userId);

        // TODO: TeamModel schema has no 'admins' field. The $pull below was a no-op.
        // If admin tracking is needed, it should be modeled via TeamMember roles or
        // a dedicated field added to the schema.
        // await this.model.updateMany(
        //     { admins: userId },
        //     { $pull: { admins: userId } }
        // );

        // TODO: TeamModel schema has no 'members' array field. The $pull below was a no-op.
        // Membership is tracked via TeamMember documents which are already deleted above.
        // for (const membership of memberships) {
        //     await this.model.updateOne(
        //         { _id: membership.props.team },
        //         { $pull: { members: membership.id } }
        //     );
        // }
    }

    async removeUserFromTeam(memberId: string, teamId: string): Promise<void> {
        // TODO: TeamModel schema has no 'members' array field. Membership removal
        // should be handled via TeamMemberRepository.
        logger.warn(`removeUserFromTeam: no-op — TeamModel has no 'members' field (memberId=${memberId}, teamId=${teamId})`);
    }

    async findUserTeams(userId: string): Promise<TeamProps[]> {
        // User belongs to a team if they are the owner OR they have a TeamMember record
        const teamIdsFromMembership = await this.teamMemberRepository.getTeamIdsByUserId(userId);

        const docs = await this.model.find({
            $or: [
                { _id: { $in: teamIdsFromMembership } },
                { owner: userId }
            ]
        }).populate('owner');

        return docs.map((doc) => this.mapper.toDomain(doc as TeamDocument).props);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.eventBus.publish(new TeamDeletedEvent({
                teamId: id
            }));
        }

        return !!result;
    }
}