import eventBus from '@shared/events/PostgresEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamMember from '@modules/team/models/TeamMember';
import teamRoomPresenceService from '@modules/team/services/team-member/TeamRoomPresenceService';
import teamMembershipService from '@modules/team/services/team/TeamMembershipService';
import ApplicationError from '@shared/errors/ApplicationError';
import { resolvePublicFileUrl } from '@shared/services/FilesystemStorageService';
import type { IMemberContentCounter } from '@shared/contracts/types/IMemberContentCounter';
import { paginate, readPageRequest, skipFor } from '@shared/persistence/paginate';
import analysisMemberContentCounter from '@modules/analysis/services/AnalysisMemberContentCounter';
import trajectoryMemberContentCounter from '@modules/trajectory/services/TrajectoryMemberContentCounter';
import whiteboardMemberContentCounter from '@modules/whiteboards/services/WhiteboardMemberContentCounter';
import type { UpdateTeamMemberInput } from '@volt/contracts/modules/team/http';
import { TeamRole } from '@volt/contracts/modules/team/access';
import { assertCanGrantTeamRole, assertCanManageTeamMember } from '@modules/team/services/team/team-role-grants';

const DEFAULT_MEMBER_LIMIT = 100;

const buildContentCounters = (): IMemberContentCounter[] => [
    trajectoryMemberContentCounter,
    analysisMemberContentCounter,
    whiteboardMemberContentCounter
];

class TeamMemberService{
    #contentCounters: IMemberContentCounter[] = buildContentCounters();

    async listByTeamId(teamId: string, page?: number, limit?: number){
        const pageRequest = readPageRequest(page, limit, { defaultLimit: DEFAULT_MEMBER_LIMIT });

        const [members, total] = await TeamMember.findAndCount({
            where: { team: teamId },
            skip: skipFor(pageRequest),
            take: pageRequest.limit,
            relations: { userRef: true }
        });

        const userIds = members.map((member) => member.user);

        const [countResults, onlineUserIds] = await Promise.all([
            Promise.all(this.#contentCounters.map((counter) => counter.countForTeamMembers(teamId, userIds))),
            teamRoomPresenceService.getOnlineUserIds(teamId)
        ]);

        const countsByMetric = new Map(countResults.map((result) => [result.key, result.counts]));
        const onlineUserIdSet = new Set(onlineUserIds);

        const data = members.map((member) => {
            const { userRef } = member;

            return {
                _id: member.id,
                team: member.team,
                user: !userRef
                    ? member.user
                    : {
                        _id: userRef.id,
                        email: userRef.email,
                        avatar: resolvePublicFileUrl(userRef.avatar) ?? userRef.avatar,
                        firstName: userRef.firstName,
                        lastName: userRef.lastName,
                        createdAt: userRef.createdAt,
                        isOnline: onlineUserIdSet.has(member.user),
                        lastSeenAt: userRef.lastSeenAt
                    },
                role: member.role,
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

    async getById(teamId: string, teamMemberId: string): Promise<TeamMember>{
        const member = await TeamMember.findOneBy({
 id: teamMemberId, team: teamId 
});
        if(!member){
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'TeamMember not found');
        }
        return member;
    }

    async updateById(teamId: string, teamMemberId: string, actorRole: TeamRole | undefined, data: UpdateTeamMemberInput): Promise<TeamMember>{
        const member = await this.getById(teamId, teamMemberId);
        assertCanManageTeamMember(actorRole, member.role);
        assertCanGrantTeamRole(actorRole, data.role);

        if(member.role === TeamRole.Owner && data.role !== TeamRole.Owner){
            const owners = await TeamMember.countBy({
 team: teamId, role: TeamRole.Owner 
});
            if(owners <= 1){
                throw ApplicationError.badRequest(ErrorCodes.TEAM_LAST_OWNER, 'A team needs at least one Owner');
            }
        }

        return Object.assign(member, { role: data.role }).save();
    }

    async deleteById(teamId: string, teamMemberId: string, actorRole: TeamRole | undefined): Promise<void>{
        const teamMember = await this.getById(teamId, teamMemberId);
        assertCanManageTeamMember(actorRole, teamMember.role);
        await teamMembershipService.removeMemberFromTeam(teamMemberId, teamId);
        await eventBus.emit('team-member.deleted', {
            teamMemberId,
            teamId
        });
    }
}

export default new TeamMemberService();
