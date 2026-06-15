import Team, { TeamProps } from '@modules/team/domain/entities/team/Team';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import teamMapper from '@modules/team/infrastructure/persistence/mongo/mappers/team/TeamMapper';
import TeamModel, { TeamDocument } from '@modules/team/infrastructure/persistence/mongo/models/team/TeamModel';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { inject } from 'tsyringe';

interface TeamMembershipIdFilter {
    _id: {
        $in: string[];
    };
};

@Singleton(TEAM_TOKENS.TeamRepository)
export default class TeamRepository
    extends MongooseBaseRepository<Team, TeamProps, TeamDocument>
    implements ITeamRepository {

    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ) {
        super(TeamModel, teamMapper);
    }

    async removeUserFromAllTeams(userId: string): Promise<void> {
        await this.teamMemberRepository.deleteByUserId(userId);
    }

    async findUserTeams(userId: string): Promise<PersistedEntityOutput<TeamProps>[]> {
        const teamIdsFromMembership = await this.teamMemberRepository.getTeamIdsByUserId(userId);
        const membershipFilter: TeamMembershipIdFilter = {
            _id: {
                $in: teamIdsFromMembership
            }
        };

        const docs = await this.model.find({
            $or: [
                membershipFilter,
                { owner: userId }
            ]
        }).populate('owner');

        return docs.map((doc) => toPersistedEntity(this.mapper.toDomain(doc)));
    }

    async findByInviteCode(code: string): Promise<Team | null> {
        const doc = await this.model.findOne({ inviteCode: code }).populate('owner');
        return doc ? this.mapper.toDomain(doc) : null;
    }

    async clearInviteCode(teamId: string): Promise<void> {
        await this.model.findByIdAndUpdate(teamId, { $unset: { inviteCode: '' } });
    }
};
