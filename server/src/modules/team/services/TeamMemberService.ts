import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import { isModuleEnabled } from '@core/bootstrap/module-state';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRoomPresenceService from '@modules/team/services/team-member/TeamRoomPresenceService';
import TeamMembershipService from '@modules/team/services/team/TeamMembershipService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IMemberContentCounter } from '@shared/contracts/ports';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import analysisMemberContentCounter from '@modules/analysis/services/AnalysisMemberContentCounter';
import trajectoryMemberContentCounter from '@modules/trajectory/services/TrajectoryMemberContentCounter';
import whiteboardMemberContentCounter from '@modules/whiteboards/services/WhiteboardMemberContentCounter';
import type { UpdateTeamMemberInput } from '@volt/contracts/modules/team/http';

const DEFAULT_MEMBER_LIMIT = 100;

const buildContentCounters = (): IMemberContentCounter[] => {
    const counters: IMemberContentCounter[] = [];
    if(isModuleEnabled('trajectory')) counters.push(trajectoryMemberContentCounter);
    if(isModuleEnabled('analysis')) counters.push(analysisMemberContentCounter);
    if(isModuleEnabled('whiteboards')) counters.push(whiteboardMemberContentCounter);
    return counters;
};

export default class TeamMemberService{
    #presence = new TeamRoomPresenceService();
    #membership = new TeamMembershipService();
    #contentCounters: IMemberContentCounter[] = buildContentCounters();

    async listByTeamId(teamId: string, page?: number, limit?: number){
        const pageRequest = readPageRequest(page, limit, { defaultLimit: DEFAULT_MEMBER_LIMIT });

        const [members, total] = await TeamMember.findAndCount({
            where: { team: teamId },
            skip: skipFor(pageRequest),
            take: pageRequest.limit,
            relations: {
                roleRef: true,
                userRef: true
            }
        });

        const userIds = members.map((member) => member.user);

        const [countResults, onlineUserIds] = await Promise.all([
            Promise.all(this.#contentCounters.map((counter) => counter.countForTeamMembers(teamId, userIds))),
            this.#presence.getOnlineUserIds(teamId)
        ]);

        const countsByMetric = new Map(countResults.map((result) => [result.key, result.counts]));
        const onlineUserIdSet = new Set(onlineUserIds);

        const data = members.map((member) => {
            const { roleRef, userRef } = member;

            return {
                _id: member.id,
                team: member.team,
                user: !userRef
                    ? member.user
                    : {
                        _id: userRef.id,
                        email: userRef.email,
                        avatar: userRef.avatar,
                        firstName: userRef.firstName,
                        lastName: userRef.lastName,
                        createdAt: userRef.createdAt,
                        isOnline: onlineUserIdSet.has(member.user),
                        lastSeenAt: userRef.lastSeenAt
                    },
                role: !roleRef
                    ? member.role
                    : {
                        _id: roleRef.id,
                        name: roleRef.name,
                        permissions: roleRef.permissions ?? [],
                        isSystem: roleRef.isSystem
                    },
                joinedAt: member.joinedAt,
                createdAt: member.createdAt,
                updatedAt: member.updatedAt,
                trajectoriesCount: countsByMetric.get('trajectoriesCount')?.get(member.user) || 0,
                analysesCount: countsByMetric.get('analysesCount')?.get(member.user) || 0,
                whiteboardsCount: countsByMetric.get('whiteboardsCount')?.get(member.user) || 0
            };
        });

        return paginate([data, total], pageRequest);
    }

    async getById(teamMemberId: string): Promise<TeamMember>{
        const member = await TeamMember.findOneBy({ id: teamMemberId });
        if(!member){
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'TeamMember not found');
        }
        return member;
    }

    async updateById(teamMemberId: string, data: UpdateTeamMemberInput): Promise<TeamMember>{
        const member = await this.getById(teamMemberId);
        return Object.assign(member, data).save();
    }

    async deleteById(teamId: string, teamMemberId: string): Promise<void>{
        const teamMember = await TeamMember.findOneBy({ id: teamMemberId });
        if(!teamMember){
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'Team member not found');
        }
        await this.#membership.removeMemberFromTeam(teamMemberId, teamId);
        await eventBus.emit('team-member.deleted', {
            teamMemberId,
            teamId
        });
    }
}
