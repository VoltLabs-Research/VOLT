import { IDailyActivityRepository } from '@modules/daily-activity/domain/ports/IDailyActivityRepository';
import DailyActivity, { ActivityType, DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import DailyActivityModel, { DailyActivityDocument } from '@modules/daily-activity/infrastructure/persistence/mongo/models/DailyActivityModel';
import dailyActitvityMapper from '@modules/daily-activity/infrastructure/persistence/mongo/mappers/DailyActivityMapper';
import { injectable } from 'tsyringe';

@injectable()
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
            { team: teamId, user: userId, date },
            {
                $inc: { minutesOnline: minutes },
                $setOnInsert: { activity: [] }
            },
            { upsert: true }
        );
    }

    async findActivityByTeamId(teamId: string, range: number): Promise<DailyActivityProps[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - range);
        startDate.setHours(0, 0, 0, 0);

        const statsQuery = {
            team: teamId,
            date: { $gte: startDate }
        };

        // Return individual documents per user/date instead of grouping by date only
        const activities = await this.model.find(statsQuery)
            .select('date user minutesOnline activity')
            .sort({ date: 1 });

        return activities.map((activity) => dailyActitvityMapper.toDomain(activity).props);
    }

    async addDailyActivity(
        teamId: string,
        userId: string,
        type: ActivityType,
        description: string
    ): Promise<void> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0);
        await this.model.updateOne(
            { team: teamId, user: userId, date: startOfDay },
            {
                $push: {
                    activity: {
                        type,
                        description,
                        createdAt: new Date()
                    }
                }
            }
        );
    }
};