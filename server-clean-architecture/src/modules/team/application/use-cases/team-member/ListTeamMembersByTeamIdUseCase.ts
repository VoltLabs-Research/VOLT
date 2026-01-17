import { Result } from "@/src/shared/domain/ports/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, TeamMemberStatsProps } from "../../dtos/team-member/ListTeamMembersByTeamIdDTO";
import { ITeamMemberRepository } from "../../../domain/ports/ITeamMemberRepository";
import { ITrajectoryRepository } from "@/src/modules/trajectory/domain/port/ITrajectoryRepository";
import { IAnalysisRepository } from "@/src/modules/analysis/domain/port/IAnalysisRepository";
import { IDailyActivityRepository } from "@/src/modules/daily-activity/domain/ports/IDailyActivityRepository";
import { TRAJECTORY_TOKENS } from "@/src/modules/trajectory/infrastructure/di/TrajectoryTokens";
import { ANALYSIS_TOKENS } from "@/src/modules/analysis/infrastructure/di/AnalysisTokens";
import { DAILY_ACTIVITY_TOKENS } from "@/src/modules/daily-activity/infrastructure/di/DailyActivityTokens";

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