import type { DailyActivityUserSummary } from '@volt/contracts/modules/daily-activity/domain';
export type { DailyActivityUserSummary };
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import DailyActivityModel, { ActivityType } from '@modules/daily-activity/models/DailyActivityModel';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import logger from '@shared/infrastructure/logger';

export interface DailyActivityRecordView {
    _id: string;
    team: string;
    user: string | DailyActivityUserSummary;
    date: Date;
    activity: { type: ActivityType; description: string; createdAt: Date }[];
    minutesOnline: number;
}

export interface GetTeamActivitySummaryInput {
    teamId: string;

    range?: number;

    userId?: string;
}

export interface GetTeamActivitySummaryResult {
    range: number;
    records: DailyActivityRecordView[];
}

const toActivityUser = (user: unknown): DailyActivityRecordView['user'] => {
    if (!isRecord(user)) {
        return String(user);
    }

    return {
        _id: String(user._id),
        firstName: typeof user.firstName === 'string' ? user.firstName : '',
        lastName: typeof user.lastName === 'string' ? user.lastName : '',
        avatar: typeof user.avatar === 'string' ? user.avatar : undefined
    };
};

export default class DailyActivityService {
    async getTeamActivitySummary(input: GetTeamActivitySummaryInput): Promise<GetTeamActivitySummaryResult> {
        const range = input.range !== undefined && Number.isFinite(input.range) && input.range > 0
            ? Math.floor(input.range)
            : 7;

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);
            startDate.setHours(0, 0, 0, 0);

            const statsQuery = {
                team: input.teamId,
                ...(input.userId ? { user: input.userId } : {}),
                date: { $gte: startDate }
            };

            const activities = await DailyActivityModel.find(statsQuery)
                .select('date user minutesOnline activity team')
                .populate('user', 'firstName lastName avatar')
                .sort({ date: 1 });

            const records: DailyActivityRecordView[] = activities.map((activity) => ({
                _id: String(activity._id),
                team: String(activity.team),
                user: toActivityUser(activity.user),
                date: activity.date,
                activity: (activity.activity ?? []).map((entry) => ({
                    type: entry.type,
                    description: entry.description,
                    createdAt: entry.createdAt
                })),
                minutesOnline: activity.minutesOnline
            }));

            return { range, records };
        } catch (error: unknown) {
            logger.error(error, 'Failed to read team activity summary');

            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to read team activity summary',
                500
            );
        }
    }

    async recordActivity(teamId: string, userId: string, type: ActivityType, description: string): Promise<void> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        await DailyActivityModel.updateOne(
            { team: teamId, user: userId, date: startOfDay },
            {
                $push: { activity: { type, description, createdAt: new Date() } },
                $setOnInsert: { minutesOnline: 0 }
            },
            { upsert: true }
        );
    }

    async recordOnlineMinutes(teamId: string, userId: string, durationInMinutes: number): Promise<void> {
        const date = new Date();
        date.setHours(0, 0, 0, 0);

        try {
            await DailyActivityModel.updateOne(
                { team: teamId, user: userId, date },
                {
                    $inc: { minutesOnline: durationInMinutes },
                    $setOnInsert: { activity: [] }
                },
                { upsert: true }
            );
        } catch (error: unknown) {
            logger.error(error, 'Failed to update user activity');

            if (error instanceof ApplicationError) {
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
