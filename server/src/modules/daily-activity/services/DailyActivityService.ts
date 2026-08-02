import { MoreThanOrEqual } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import type { ActivityType, DailyActivityUserSummary } from '@volt/contracts/modules/daily-activity/domain';import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import DailyActivity from '@modules/daily-activity/models/DailyActivity';
import type User from '@modules/auth/models/User';
import logger from '@shared/infrastructure/logger';

interface DailyActivityRecordView {
    _id: string;
    team: string;
    user: string | DailyActivityUserSummary;
    date: Date;
    activity: { type: ActivityType; description: string; createdAt: Date }[];
    minutesOnline: number;
}

interface GetTeamActivitySummaryInput {
    teamId: string;

    range?: number;

    userId?: string;
}

interface GetTeamActivitySummaryResult {
    range: number;
    records: DailyActivityRecordView[];
}

const startOfToday = (): Date => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const toActivityUser = (user: User | null | undefined): DailyActivityRecordView['user'] => {
    if(!user){
        return String(user);
    }

    return {
        _id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar ?? undefined
    };
};

export default class DailyActivityService{
    async getTeamActivitySummary(input: GetTeamActivitySummaryInput): Promise<GetTeamActivitySummaryResult>{
        const range = input.range !== undefined && Number.isFinite(input.range) && input.range > 0
            ? Math.floor(input.range)
            : 7;

        try{
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);
            startDate.setHours(0, 0, 0, 0);

            const statsQuery: FindOptionsWhere<DailyActivity> = {
                team: input.teamId,
                ...(input.userId ? { user: input.userId } : {}),
                date: MoreThanOrEqual(startDate)
            };

            const activities = await DailyActivity.find({
                where: statsQuery,
                relations: { userRef: true },
                order: { date: 'ASC' }
            });

            const records: DailyActivityRecordView[] = activities.map((activity) => ({
                _id: activity.id,
                team: activity.team,
                user: toActivityUser(activity.userRef),
                date: activity.date,
                activity: (activity.activity ?? []).map((entry) => ({
                    type: entry.type,
                    description: entry.description,
                    createdAt: new Date(entry.createdAt)
                })),
                minutesOnline: activity.minutesOnline
            }));

            return {
                range,
                records
            };
        }catch(error: unknown){
            logger.error(error, 'Failed to read team activity summary');

            if(error instanceof ApplicationError){
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to read team activity summary',
                500
            );
        }
    }

    async recordActivity(teamId: string, userId: string, type: ActivityType, description: string): Promise<void>{
        const date = startOfToday();
        const entry = {
            type,
            description,
            createdAt: new Date()
        };

        const existing = await DailyActivity.findOneBy({
            team: teamId,
            user: userId,
            date
        });

        if(!existing){
            await DailyActivity.create({
                team: teamId,
                user: userId,
                date,
                activity: [entry],
                minutesOnline: 0
            }).save();
            return;
        }

        await Object.assign(existing, { activity: [...(existing.activity ?? []), entry] }).save();
    }

    async recordOnlineMinutes(teamId: string, userId: string, durationInMinutes: number): Promise<void>{
        const date = startOfToday();

        try{
            const target: FindOptionsWhere<DailyActivity> = {
                team: teamId,
                user: userId,
                date
            };

            const exists = await DailyActivity.existsBy(target);
            if(exists){
                await DailyActivity.getRepository().increment(target, 'minutesOnline', durationInMinutes);
                return;
            }

            await DailyActivity.create({
                team: teamId,
                user: userId,
                date,
                activity: [],
                minutesOnline: durationInMinutes
            }).save();
        }catch(error: unknown){
            logger.error(error, 'Failed to update user activity');

            if(error instanceof ApplicationError){
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update activity stats',
                500
            );
        }
    }
}
