import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, TeamMemberStatsProps } from '@modules/team/application/dtos/team-member/ListTeamMembersByTeamIdDTO';
import { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import {
    isPopulatedTeamMemberUser,
    getTeamMemberUserId
} from '@modules/team/domain/entities/TeamMember';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import TeamPresenceService from '@modules/team/application/services/TeamPresenceService';

@injectable()
export default class ListTeamMembersByTeamIdUseCase implements IUseCase<ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private readonly dailyActivityRepository: IDailyActivityRepository,

        @inject(TEAM_TOKENS.TeamPresenceService)
        private readonly teamPresenceService: TeamPresenceService
    ){}

    async execute(input: ListTeamMembersByTeamIdInputDTO): Promise<Result<ListTeamMembersByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const teamMembers = await this.teamMemberRepository.findAll({
            filter: { team: teamId },
            populate: [
                { path: 'role', select: ['name', 'permissions', 'isSystem'] },
                { path: 'user', select: ['email', 'avatar', 'firstName', 'lastName', 'lastSeenAt', 'createdAt'] }
            ],
            page: input.page,
            limit: input.limit
        });

        const userIds = teamMembers.data.map(
            (member) => {
                return getTeamMemberUserId(member.props.user);
            }
        );

        const [dailyActivities, trajectoryCounts, analysisCounts] = await Promise.all([
            this.dailyActivityRepository.findActivityByTeamId(teamId, 7),
            this.trajectoryRepository.countGroupedBy('createdBy', userIds),
            this.analysisRepository.countGroupedBy('createdBy', userIds)
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
                analysesCount: analysisCounts.get(userId) || 0
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
