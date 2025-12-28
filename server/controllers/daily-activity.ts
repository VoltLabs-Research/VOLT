import { Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import { DailyActivity } from '@/models';
import { IDailyActivity } from '@/models/daily-activity';
import BaseController from '@/controllers/base-controller';
import { NextFunction } from 'express-serve-static-core';

export default class DailyActivityController extends BaseController<IDailyActivity>{
    constructor(){
        super(DailyActivity, {
            resourceName: 'DailyActivity',
            fields: ['date']
        });
    }

    public getTeamActivity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { range } = req.query;
        const teamId = await this.getTeamId(req);

        console.log('get team activity', teamId);
        const statsQuery: any = { team: teamId };

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
        
        console.log(activities)

        res.status(200).json({
            status: 'success',
            data: activities
        })
    });
};