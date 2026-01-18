import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, TeamMemberStatsProps } from '@modules/team/application/dtos/team-member/ListTeamMembersByTeamIdDTO';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { IDailyActivityRepository } from '@modules/daily-activity/domain/ports/IDailyActivityRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';

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
        private readonly dailyActivityRepository: IDailyActivityRepository
    ) { }

    async execute(input: ListTeamMembersByTeamIdInputDTO): Promise<Result<ListTeamMembersByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const teamMembers = await this.teamMemberRepository.findAll({
            filter: { team: teamId },
            populate: [
                { path: 'role', select: ['name', 'permissions', 'isSystem'] },
                { path: 'user', select: ['email', 'avatar', 'firstName', 'lastName', 'lastLoginAt', 'createdAt'] }
            ],
            page: 1,
            limit: 100
        });

        // Get daily activity for the last 7 days for the whole team
        const dailyActivities = await this.dailyActivityRepository.findActivityByTeamId(teamId, 7);

        const data: TeamMemberStatsProps[] = await Promise.all(
            teamMembers.data.map(async (member) => {
                const userId = member.props.user._id.toString();

                const [trajectoriesCount, analysesCount] = await Promise.all([
                    this.trajectoryRepository.count({ createdBy: userId }),
                    this.analysisRepository.count({ createdBy: userId })
                ]);

                const userActivity = dailyActivities.filter(activity => activity.user.toString() === userId);
                const timeSpentLast7Days = userActivity.reduce((acc, curr) => acc + (curr.minutesOnline || 0), 0);

                return {
                    ...member.props,
                    timeSpentLast7Days,
                    trajectoriesCount,
                    analysesCount
                };
            })
        );

        return Result.ok({
            ...teamMembers,
            data
        });
    }
}