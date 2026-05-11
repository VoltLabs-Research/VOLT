import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import { ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, TeamMemberStatsProps } from '@modules/team/application/dtos/team-member/ListTeamMembersByTeamIdDTO';
import { getTeamMemberUserId, isPopulatedTeamMemberUser } from '@modules/team/domain/entities/team-member/TeamMember';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRoomPresenceService from '@modules/team/infrastructure/services/team-member/TeamRoomPresenceService';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

interface TeamMemberFilter {
    team: string;
}

@injectable()
export default class ListTeamMembersByTeamIdUseCase implements IUseCase<ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, ApplicationError> {
    constructor(
        private readonly teamMemberRepository: TeamMemberRepository,
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly analysisRepository: AnalysisRepository,
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly whiteboardRepository: WhiteboardRepository,
        private readonly teamRoomPresenceService: TeamRoomPresenceService
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

        const [
            trajectoryCounts,
            analysisCounts,
            latexCounts,
            whiteboardCounts,
            onlineUserIds
        ] = await Promise.all([
            this.trajectoryRepository.countGroupedBy('createdBy', userIds, { team: teamId }),
            this.analysisRepository.countGroupedBy('createdBy', userIds, { team: teamId }),
            this.latexDocumentRepository.countGroupedBy('createdBy', userIds, { team: teamId }),
            this.whiteboardRepository.countGroupedBy('createdBy', userIds, { team: teamId }),
            this.teamRoomPresenceService.getOnlineUserIds(teamId)
        ]);
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
                trajectoriesCount: trajectoryCounts.get(userId) || 0,
                analysesCount: analysisCounts.get(userId) || 0,
                latexCount: latexCounts.get(userId) || 0,
                whiteboardsCount: whiteboardCounts.get(userId) || 0
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
