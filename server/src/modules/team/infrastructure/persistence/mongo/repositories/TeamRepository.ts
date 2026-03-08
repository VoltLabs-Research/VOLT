import { ITeamRepository } from '@modules/team/domain/port/ITeamRepository';
import { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import Team, { TeamProps } from '@modules/team/domain/entities/Team';
import TeamModel, { TeamDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamModel';
import teamMapper from '@modules/team/infrastructure/persistence/mongo/mappers/TeamMapper';
import { injectable, inject } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PersistedEntity } from '@modules/team/domain/contracts/PersistedEntity';

@injectable()
export default class TeamRepository
    extends MongooseBaseRepository<Team, TeamProps, TeamDocument>
    implements ITeamRepository {

    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
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
        // Find all team memberships for the user using repository
        const memberships = await this.teamMemberRepository.findByUserId(userId);

        // Remove TeamMember records using repository
        await this.teamMemberRepository.deleteByUserId(userId);

        // Remove user from admins arrays (if they are stored as User IDs there)
        await this.model.updateMany(
            { admins: userId },
            { $pull: { admins: userId } }
        );

        // For the members array in Team, they are TeamMember IDs, so we need to pull the specific member IDs
        for (const membership of memberships) {
            await this.model.updateOne(
                { _id: membership.props.team },
                { $pull: { members: membership._id } }
            );
        }
    }

    async removeUserFromTeam(memberId: string, teamId: string): Promise<void> {
        await this.model.findByIdAndUpdate(teamId, {
            $pull: {
                members: memberId
            }
        });
    }

    async findUserTeams(userId: string): Promise<PersistedEntity<TeamProps>[]> {
        // User belongs to a team if they are the owner OR they have a TeamMember record
        const teamIdsFromMembership = await this.teamMemberRepository.getTeamIdsByUserId(userId);

        const docs = await this.model.find({
            $or: [
                { _id: { $in: teamIdsFromMembership } },
                { owner: userId }
            ]
        }).populate('owner');

        return docs.map((doc) => toPersistedOutput(this.mapper.toDomain(doc as TeamDocument)));
    }
}
