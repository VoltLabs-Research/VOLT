import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRoomPresenceService } from '@modules/team/ports/team-member/ITeamRoomPresenceService';
import type { ITeamMembershipService } from '@modules/team/ports/team/ITeamMembershipService';
import { getTeamMemberUserId, isPopulatedTeamMemberUser } from '@modules/team/entities/team-member/TeamMember';
import type { TeamMemberProps } from '@modules/team/entities/team-member/TeamMember';
import TeamMemberDeletedEvent from '@modules/team/events/team-member/TeamMemberDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IMemberContentCounter } from '@shared/contracts/ports';
import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { container as diContainer } from 'tsyringe';
import type { UpdateTeamMemberInput } from '@volt/contracts/modules/team/http';

interface TeamMemberStatsProps extends TeamMemberProps {
    trajectoriesCount: number;
    analysesCount: number;
    latexCount: number;
    whiteboardsCount: number;
}

/**
 * The single application service for the team-member resource. Folds the former
 * list/update/delete use-cases. The member repository, room-presence service and
 * membership orchestrator are shared singletons (cross-module + event handlers),
 * resolved once from the DI container. The member-content counters are a
 * `resolveAll` collection contributed by other modules (trajectory/analysis/…).
 */
export default class TeamMemberService {
    #members = diContainer.resolve<ITeamMemberRepository>(TEAM_TOKENS.TeamMemberRepository);
    #presence = diContainer.resolve<ITeamRoomPresenceService>(TEAM_TOKENS.TeamRoomPresenceService);
    #membership = diContainer.resolve<ITeamMembershipService>(TEAM_TOKENS.TeamMembershipService);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    #contentCounters: IMemberContentCounter[] = diContainer.isRegistered(MEMBER_CONTENT_COUNTER_TOKEN)
        ? diContainer.resolveAll<IMemberContentCounter>(MEMBER_CONTENT_COUNTER_TOKEN)
        : [];

    async listByTeamId(teamId: string, page?: number, limit?: number): Promise<PaginatedResult<Record<string, unknown>>> {
        const teamMembers = await this.#members.findAll({
            filter: { team: teamId },
            populate: [
                { path: 'role', select: ['name', 'permissions', 'isSystem'] },
                { path: 'user', select: ['email', 'avatar', 'firstName', 'lastName', 'lastSeenAt', 'createdAt'] }
            ],
            page,
            limit
        });

        const userIds = teamMembers.data.map((member) => getTeamMemberUserId(member.props.user));

        const [countResults, onlineUserIds] = await Promise.all([
            Promise.all(this.#contentCounters.map((counter) => counter.countForTeamMembers(teamId, userIds))),
            this.#presence.getOnlineUserIds(teamId)
        ]);

        const countsByMetric = new Map<string, Map<string, number>>();
        for (const result of countResults) {
            countsByMetric.set(result.key, result.counts);
        }

        const onlineUserIdSet = new Set(onlineUserIds);

        const data = teamMembers.data.map((member) => {
            const userId = getTeamMemberUserId(member.props.user);
            const user = isPopulatedTeamMemberUser(member.props.user)
                ? member.props.user
                : undefined;

            const memberStats: TeamMemberStatsProps = {
                ...member.props,
                user: user
                    ? { ...user, isOnline: onlineUserIdSet.has(userId), lastSeenAt: user.lastSeenAt }
                    : member.props.user,
                trajectoriesCount: countsByMetric.get('trajectoriesCount')?.get(userId) || 0,
                analysesCount: countsByMetric.get('analysesCount')?.get(userId) || 0,
                latexCount: countsByMetric.get('latexCount')?.get(userId) || 0,
                whiteboardsCount: countsByMetric.get('whiteboardsCount')?.get(userId) || 0
            };

            return { _id: member._id, ...memberStats } as unknown as Record<string, unknown>;
        });

        return { ...teamMembers, data };
    }

    async getById(teamMemberId: string): Promise<Record<string, unknown>> {
        const member = await this.#members.findById(teamMemberId);
        if (!member) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'TeamMember not found');
        }
        return toPersistedOutput(member) as unknown as Record<string, unknown>;
    }

    async updateById(teamMemberId: string, data: UpdateTeamMemberInput): Promise<Record<string, unknown>> {
        const member = await this.#members.updateById(teamMemberId, data as Partial<TeamMemberProps>);
        if (!member) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'TeamMember not found');
        }
        return toPersistedOutput(member) as unknown as Record<string, unknown>;
    }

    async deleteById(teamId: string, teamMemberId: string): Promise<void> {
        const teamMember = await this.#members.findById(teamMemberId);
        if (!teamMember) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_MEMBER_NOT_FOUND, 'Team member not found');
        }
        await this.#membership.removeMemberFromTeam(teamMemberId, teamId);
        await this.#eventBus.publish(new TeamMemberDeletedEvent({ teamMemberId, teamId }));
    }
}
