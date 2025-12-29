import { Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import { DailyActivity } from '@/models';
import { IDailyActivity } from '@/models/daily-activity';
import { NextFunction } from 'express-serve-static-core';
import { Resource } from '@/constants/resources';
import { Types } from 'mongoose';
import BaseController from '@/controllers/base-controller';

export default class DailyActivityController extends BaseController<IDailyActivity> {
    constructor() {
        super(DailyActivity, {
            resource: Resource.DAILY_ACTIVITY,
            fields: ['date']
        });
    }

    public getTeamActivity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { range, userId } = req.query;
        const teamId = await this.getTeamId(req);

        const statsQuery: any = { team: new Types.ObjectId(teamId) };

        // Filter by specific user if provided
        if (userId) {
            statsQuery.user = new Types.ObjectId(userId as string);
        }

        const days = range ? parseInt(range as string) : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        statsQuery.date = { $gte: startDate };

        const activities = await DailyActivity.aggregate([
            { $match: statsQuery },
            {
                $group: {
                    _id: '$date',
                    date: { $first: '$date' },
                    activity: { $push: '$activity' },
                    minutesOnline: { $sum: '$minutesOnline' }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: 1,
                    minutesOnline: 1,
                    activity: {
                        $reduce: {
                            input: '$activity',
                            initialValue: [],
                            in: { $concatArrays: ['$$value', '$$this'] }
                        }
                    }
                }
            },
            { $sort: { date: 1 } }
        ]);

        res.status(200).json({
            status: 'success',
            data: activities
        })
    });
};