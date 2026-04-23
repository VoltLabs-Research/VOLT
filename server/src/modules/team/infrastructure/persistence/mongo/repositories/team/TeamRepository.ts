import Team, { TeamProps } from '@modules/team/domain/entities/team/Team';
import teamMapper from '@modules/team/infrastructure/persistence/mongo/mappers/team/TeamMapper';
import TeamModel, { TeamDocument } from '@modules/team/infrastructure/persistence/mongo/models/team/TeamModel';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

interface TeamMembersPushUpdate {
    $push: {
        members: string;
    };
};

interface TeamRolesPushUpdate {
    $push: {
        roles: string;
    };
};

interface TeamAdminsPullUpdate {
    $pull: {
        admins: string;
    };
};

interface TeamMembersPullUpdate {
    $pull: {
        members: string;
    };
};

interface TeamMembershipIdFilter {
    _id: {
        $in: string[];
    };
};

@Singleton()
export default class TeamRepository
    extends MongooseBaseRepository<Team, TeamProps, TeamDocument> {

    constructor(
        
        private readonly teamMemberRepository: TeamMemberRepository
    ) {
        super(TeamModel, teamMapper);
    }

    async addMemberToTeam(memberId: string, teamId: string): Promise<void> {
        const update: TeamMembersPushUpdate = {
            $push: {
                members: memberId
            }
        };

        await this.model.updateOne({ _id: teamId }, update);
    }

    async addRoleToTeam(roleId: string, teamId: string): Promise<void> {
        const update: TeamRolesPushUpdate = {
            $push: {
                roles: roleId
            }
        };

        await this.model.updateOne({ _id: teamId }, update);
    }

    async removeUserFromAllTeams(userId: string): Promise<void> {
        const memberships = await this.teamMemberRepository.findByUserId(userId);
        await this.teamMemberRepository.deleteByUserId(userId);
        const adminsUpdate: TeamAdminsPullUpdate = {
            $pull: {
                admins: userId
            }
        };

        await this.model.updateMany(
            { admins: userId },
            adminsUpdate
        );

        for (const membership of memberships) {
            const update: TeamMembersPullUpdate = {
                $pull: {
                    members: membership._id
                }
            };

            await this.model.updateOne(
                { _id: membership.props.team },
                update
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
