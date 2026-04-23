import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import { ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, TeamMemberStatsProps } from '@modules/team/application/dtos/team-member/ListTeamMembersByTeamIdDTO';
import { getTeamMemberUserId, isPopulatedTeamMemberUser } from '@modules/team/domain/entities/team-member/TeamMember';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamPresenceService from '@modules/team/infrastructure/services/team-member/TeamPresenceService';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

interface TeamMemberFilter {
    team: string;
};

@injectable()
export default class ListTeamMembersByTeamIdUseCase implements IUseCase<ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, ApplicationError> {
    constructor(
        
        private readonly teamMemberRepository: TeamMemberRepository,

        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly analysisRepository: AnalysisRepository,

        
        private readonly latexDocumentRepository: LatexDocumentRepository,

        
        private readonly whiteboardRepository: WhiteboardRepository,

        
        private readonly dailyActivityRepository: DailyActivityRepository,

        
        private readonly teamPresenceService: TeamPresenceService
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

        const userIds = teamMembers.data.map((member) => {
            return getTeamMemberUserId(member.props.user);
        });

        const [dailyActivities, trajectoryCounts, analysisCounts, latexCounts, whiteboardCounts] = await Promise.all([
            this.dailyActivityRepository.findActivityByTeamId(teamId, 7),
            this.trajectoryRepository.countGroupedBy('createdBy', userIds),
            this.analysisRepository.countGroupedBy('createdBy', userIds),
            this.latexDocumentRepository.countGroupedBy('createdBy', userIds),
            this.whiteboardRepository.countGroupedBy('createdBy', userIds)
        ]);

        const activityByUser = new Map<string, number>();
        for (const activity of dailyActivities) {
            let activityUserId: string;
            if (typeof activity.user === 'string') {
                activityUserId = activity.user;
            } else {
                activityUserId = activity.user._id.toString();
            }
            const current = activityByUser.get(activityUserId) || 0;
            activityByUser.set(activityUserId, current + (activity.minutesOnline || 0));
        }

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
                        isOnline: this.teamPresenceService.isUserOnline(teamId, userId),
                        lastSeenAt: user.lastSeenAt
                    }
                    : member.props.user,
                timeSpentLast7Days: activityByUser.get(userId) || 0,
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
};
