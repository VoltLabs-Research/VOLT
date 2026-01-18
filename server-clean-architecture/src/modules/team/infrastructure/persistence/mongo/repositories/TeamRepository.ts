import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import Team, { TeamProps } from '@modules/team/domain/entities/Team';
import TeamModel, { TeamDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamModel';
import TeamMemberModel from '@modules/team/infrastructure/persistence/mongo/models/TeamMemberModel';
import teamMapper from '@modules/team/infrastructure/persistence/mongo/mappers/TeamMapper';
import { injectable, inject } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';

@injectable()
export default class TeamRepository
    extends MongooseBaseRepository<Team, TeamProps, TeamDocument>
    implements ITeamRepository {

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {
        super(TeamModel, teamMapper);
    }

    async addMemberToTeam(memberId: string, teamId: string): Promise<void> {
        await this.model.updateOne({ _id: teamId }, {
            $push: { members: memberId }
        });
    }

    async addRoleToTeam(roleId: string, teamId: string): Promise<void> {
        await this.model.updateOne({ _id: teamId }, {
            $push: { roles: roleId }
        });
    }

    async removeUserFromAllTeams(userId: string): Promise<void> {
        // Find all team memberships for the user
        const memberships = await TeamMemberModel.find({ user: userId });

        // Remove TeamMember records
        await TeamMemberModel.deleteMany({ user: userId });

        // Remove user from admins arrays (if they are stored as User IDs there)
        await this.model.updateMany(
            { admins: userId },
            { $pull: { admins: userId } }
        );

        // For the members array in Team, they are TeamMember IDs, so we need to pull the specific member IDs
        for (const membership of memberships) {
            await this.model.updateOne(
                { _id: membership.team },
                { $pull: { members: membership._id } }
            );
        }
    }

    async hasAccess(userId: string, teamId: string): Promise<boolean> {
        // Check if user is owner
        const isOwner = await this.model.exists({ _id: teamId, owner: userId });
        if (isOwner) return true;

        // Check if user is in admins (assuming admins are User IDs)
        const isAdmin = await this.model.exists({ _id: teamId, admins: userId });
        if (isAdmin) return true;

        // Check if user is a TeamMember
        const isMember = await TeamMemberModel.exists({ team: teamId, user: userId });
        return isMember !== null;
    }

    async removeUserFromTeam(userId: string, teamId: string): Promise<void> {
        const membership = await TeamMemberModel.findOne({ user: userId, team: teamId });
        if (membership) {
            await TeamMemberModel.deleteOne({ _id: membership._id });
            await this.model.findByIdAndUpdate(teamId, {
                $pull: {
                    members: membership._id,
                    admins: userId
                }
            });
        }
    }

    async findUserTeams(userId: string): Promise<TeamProps[]> {
        // User belongs to a team if they are the owner OR they have a TeamMember record
        const memberships = await TeamMemberModel.find({ user: userId }).select('team');
        const teamIdsFromMembership = memberships.map(m => m.team);

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

    async getTeamMembersWithUserData(teamId: string): Promise<any[]> {
        const team = await this.model.findById(teamId)
            .populate('owner', 'firstName lastName email avatar')
            .populate({
                path: 'members',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email avatar'
                }
            });

        if (!team) {
            return [];
        }

        const members: any[] = [];

        if (team.owner) {
            members.push(team.owner);
        }

        if (team.members && Array.isArray(team.members)) {
            // team.members are now TeamMember documents (populated with user)
            const userMembers = team.members
                .map((m: any) => m.user)
                .filter((u: any) => !!u);
            members.push(...userMembers);
        }

        return members;
    }
}