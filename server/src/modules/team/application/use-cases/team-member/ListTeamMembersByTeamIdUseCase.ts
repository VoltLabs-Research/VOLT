import type WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRoomPresenceService } from '@modules/team/domain/port/team-member/ITeamRoomPresenceService';
import { ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, TeamMemberStatsProps } from '@modules/team/application/dtos/team-member/ListTeamMembersByTeamIdDTO';
import { getTeamMemberUserId, isPopulatedTeamMemberUser } from '@modules/team/domain/entities/team-member/TeamMember';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface TeamMemberFilter {
    team: string;
}

@injectable()
export default class ListTeamMembersByTeamIdUseCase implements IUseCase<ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) private readonly whiteboardRepository: WhiteboardRepository,
        @inject(TEAM_TOKENS.TeamRoomPresenceService) private readonly teamRoomPresenceService: ITeamRoomPresenceService
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
