import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import { isModuleEnabled } from '@core/bootstrap/module-state';
import TeamMemberModel, { getTeamMemberUserId, isPopulatedTeamMemberUser } from '@modules/team/models/team-member/TeamMemberModel';
import type { TeamMemberProps } from '@modules/team/models/team-member/TeamMemberModel';
import TeamRoomPresenceService from '@modules/team/services/team-member/TeamRoomPresenceService';
import TeamMembershipService from '@modules/team/services/team/TeamMembershipService';
import { toPersistedOutput } from '@modules/team/utilities/toPersistedOutput';
import TeamMemberDeletedEvent from '@modules/team/events/team-member/TeamMemberDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IMemberContentCounter } from '@shared/contracts/ports';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import analysisMemberContentCounter from '@modules/analysis/member-content/AnalysisMemberContentCounter';
import latexMemberContentCounter from '@modules/latex/member-content/LatexMemberContentCounter';
import trajectoryMemberContentCounter from '@modules/trajectory/member-content/TrajectoryMemberContentCounter';
import whiteboardMemberContentCounter from '@modules/whiteboards/member-content/WhiteboardMemberContentCounter';
import type { UpdateTeamMemberInput } from '@volt/contracts/modules/team/http';

const buildContentCounters = (): IMemberContentCounter[] => {
    const counters: IMemberContentCounter[] = [];
    if (isModuleEnabled('trajectory')) counters.push(trajectoryMemberContentCounter);
    if (isModuleEnabled('analysis')) counters.push(analysisMemberContentCounter);
    if (isModuleEnabled('latex')) counters.push(latexMemberContentCounter);
    if (isModuleEnabled('whiteboards')) counters.push(whiteboardMemberContentCounter);
    return counters;
};

const TEAM_MEMBER_RELATIONS = ['team', 'user', 'role'];

interface TeamMemberStatsProps extends TeamMemberProps {
    trajectoriesCount: number;
    analysesCount: number;
    latexCount: number;
    whiteboardsCount: number;
}

export default class TeamMemberService {
    #presence = new TeamRoomPresenceService();
    #membership = new TeamMembershipService();
    #eventBus = eventBus;
    #contentCounters: IMemberContentCounter[] = buildContentCounters();

    async listByTeamId(teamId: string, page?: number, limit?: number): Promise<PaginatedResult<Record<string, unknown>>> {
        const resolvedPage = page ?? 1;
        const resolvedLimit = limit ?? 100;
        const filter = { team: teamId };
        const skip = (resolvedPage - 1) * resolvedLimit;

        const [docs, total] = await Promise.all([
            TeamMemberModel.find(filter)
                .populate({ path: 'role', select: ['name', 'permissions', 'isSystem'] })
                .populate({ path: 'user', select: ['email', 'avatar', 'firstName', 'lastName', 'lastSeenAt', 'createdAt'] })
                .skip(skip)
                .limit(resolvedLimit),
            TeamMemberModel.countDocuments(filter)
        ]);

        const teamMembers = docs.map((doc) => toPersistedOutput<TeamMemberProps>(doc, TEAM_MEMBER_RELATIONS));
        const userIds = teamMembers.map((member) => getTeamMemberUserId(member.user));

        const [countResults, onlineUserIds] = await Promise.all([
            Promise.all(this.#contentCounters.map((counter) => counter.countForTeamMembers(teamId, userIds))),
            this.#presence.getOnlineUserIds(teamId)
        ]);

        const countsByMetric = new Map<string, Map<string, number>>();
        for (const result of countResults) {
            countsByMetric.set(result.key, result.counts);
        }

        const onlineUserIdSet = new Set(onlineUserIds);

        const data = teamMembers.map((member) => {
            const userId = getTeamMemberUserId(member.user);
            const user = isPopulatedTeamMemberUser(member.user)
                ? member.user
                : undefined;

            const memberStats: TeamMemberStatsProps = {
                ...member,
                user: user
                    ? { ...user, isOnline: onlineUserIdSet.has(userId), lastSeenAt: user.lastSeenAt }
                    : member.user,
                trajectoriesCount: countsByMetric.get('trajectoriesCount')?.get(userId) || 0,
                analysesCount: countsByMetric.get('analysesCount')?.get(userId) || 0,
                latexCount: countsByMetric.get('latexCount')?.get(userId) || 0,
                whiteboardsCount: countsByMetric.get('whiteboardsCount')?.get(userId) || 0
            };

            return { _id: member._id, ...memberStats } as unknown as Record<string, unknown>;
        });

        return {
            data,
            total,
            page: resolvedPage,
            totalPages: Math.ceil(total / resolvedLimit),
            limit: resolvedLimit
        };
    }

    async getById(teamMemberId: string): Promise<Record<string, unknown>> {
        const member = await TeamMemberModel.findById(teamMemberId);
        if (!member) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'TeamMember not found');
        }
        return toPersistedOutput(member, TEAM_MEMBER_RELATIONS) as unknown as Record<string, unknown>;
    }

    async updateById(teamMemberId: string, data: UpdateTeamMemberInput): Promise<Record<string, unknown>> {
        const member = await TeamMemberModel.findByIdAndUpdate(teamMemberId, { $set: data }, { new: true });
        if (!member) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'TeamMember not found');
        }
        return toPersistedOutput(member, TEAM_MEMBER_RELATIONS) as unknown as Record<string, unknown>;
    }

    async deleteById(teamId: string, teamMemberId: string): Promise<void> {
        const teamMember = await TeamMemberModel.findById(teamMemberId);
        if (!teamMember) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'Team member not found');
        }
        await this.#membership.removeMemberFromTeam(teamMemberId, teamId);
        await this.#eventBus.publish(new TeamMemberDeletedEvent({ teamMemberId, teamId }));
    }
}
