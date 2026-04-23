import type DailyActivity from '@modules/daily-activity/domain/entities/DailyActivity';
import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import dailyActitvityMapper from '@modules/daily-activity/infrastructure/persistence/mongo/mappers/DailyActivityMapper';
import DailyActivityModel from '@modules/daily-activity/infrastructure/persistence/mongo/models/DailyActivityModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';
import type { DailyActivityRecord, IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { DailyActivityDocument } from '@modules/daily-activity/infrastructure/persistence/mongo/models/DailyActivityModel';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

const toActivityUser = (user: unknown): DailyActivityRecord['user'] => {
    if (!isRecord(user)) {
        return String(user);
    }

    const identifier = user._id;

    return {
        _id: String(identifier),
        firstName: typeof user.firstName === 'string' ? user.firstName : '',
        lastName: typeof user.lastName === 'string' ? user.lastName : '',
        avatar: typeof user.avatar === 'string' ? user.avatar : undefined
    };
};

@Singleton()
export default class DailyActivityRepository
    extends MongooseBaseRepository<DailyActivity, DailyActivityProps, DailyActivityDocument>
    implements IDailyActivityRepository {

    constructor() {
        super(DailyActivityModel, dailyActitvityMapper);
    }

    async updateOnlineMinutes(
        teamId: string,
        userId: string,
        date: Date,
        minutes: number
    ): Promise<void> {
        await this.model.updateOne(
            {
                team: teamId,
                user: userId,
                date
            },
            {
                $inc: { minutesOnline: minutes },
                $setOnInsert: { activity: [] }
            },
            { upsert: true }
        );
    }

    async findActivityByTeamId(teamId: string, range: number): Promise<DailyActivityRecord[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - range);
        startDate.setHours(0, 0, 0, 0);

        const statsQuery = {
            team: teamId,
            date: { $gte: startDate }
        };

        // Return individual documents per user/date instead of grouping by date only
        const activities = await this.model.find(statsQuery)
            .select('date user minutesOnline activity team')
            .populate('user', 'firstName lastName avatar')
            .sort({ date: 1 });

        return activities.map((activity) => {
            const dailyActivity = dailyActitvityMapper.toDomain(activity);

            return {
                _id: dailyActivity._id,
                ...dailyActivity.props,
                user: toActivityUser(activity.user)
            };
        });
    }

    async addDailyActivity(
        teamId: string,
        userId: string,
        type: ActivityType,
        description: string
    ): Promise<void> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        await this.model.updateOne(
            {
                team: teamId,
                user: userId,
                date: startOfDay
            },
            {
                $push: {
                    activity: {
                        type,
                        description,
                        createdAt: new Date()
                    }
                },
                $setOnInsert: { minutesOnline: 0 }
            },
            { upsert: true }
        );
    }
};
