import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import type { IMemberContentCounter } from '@shared/contracts/ports';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRoomPresenceService } from '@modules/team/domain/port/team-member/ITeamRoomPresenceService';
import { ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, TeamMemberStatsProps } from '@modules/team/application/dtos/team-member/ListTeamMembersByTeamIdDTO';
import { getTeamMemberUserId, isPopulatedTeamMemberUser } from '@modules/team/domain/entities/team-member/TeamMember';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable, injectAll } from 'tsyringe';

interface TeamMemberFilter {
    team: string;
}

@injectable()
export default class ListTeamMembersByTeamIdUseCase implements IUseCase<ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRoomPresenceService) private readonly teamRoomPresenceService: ITeamRoomPresenceService,
        // Per-member content counts are contributed by feature modules through a
        // neutral collection token (detachable-modules migration). The team
        // (kernel) module no longer imports trajectory/analysis/latex/whiteboard
        // repositories directly. Disabled features simply don't register a
        // counter, so their metric is absent and treated as 0 by the UI.
        @injectAll(MEMBER_CONTENT_COUNTER_TOKEN) private readonly memberContentCounters: IMemberContentCounter[] = []
    ) {}

    async execute(input: ListTeamMembersByTeamIdInputDTO): Promise<Result<ListTeamMembersByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const filter: TeamMemberFilter = { team: teamId };

        const teamMembers = await this.teamMemberRepository.findAll({
            filter,
            populate: [
                { path: 'role', select: ['name', 'permissions', 'isSystem'] },
                { path: 'user', select: ['email', 'avatar', 'firstName', 'lastName', 'lastSeenAt', 'createdAt'] }
            ],
            page: input.page,
            limit: input.limit
        });

        const userIds = teamMembers.data.map((member) => getTeamMemberUserId(member.props.user));

        const [countResults, onlineUserIds] = await Promise.all([
            Promise.all(this.memberContentCounters.map((counter) => counter.countForTeamMembers(teamId, userIds))),
            this.teamRoomPresenceService.getOnlineUserIds(teamId)
        ]);

        // Merge every contributed metric into a single key -> (userId -> count) map.
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
                    ? {
                        ...user,
                        isOnline: onlineUserIdSet.has(userId),
                        lastSeenAt: user.lastSeenAt
                    }
                    : member.props.user,
                trajectoriesCount: countsByMetric.get('trajectoriesCount')?.get(userId) || 0,
                analysesCount: countsByMetric.get('analysesCount')?.get(userId) || 0,
                latexCount: countsByMetric.get('latexCount')?.get(userId) || 0,
                whiteboardsCount: countsByMetric.get('whiteboardsCount')?.get(userId) || 0
            };

            return {
                _id: member._id,
                ...memberStats
            };
        });

        return Result.ok({
            ...teamMembers,
            data
        });
    }
}
