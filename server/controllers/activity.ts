/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import BaseController from '@/controllers/base-controller';
import { DailyActivity } from '@/models';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { IDailyActivity } from '@/models/daily-activity';
import { Types } from 'mongoose';

export default class ActivityController extends BaseController<IDailyActivity> {
    constructor() {
        super(DailyActivity, {
            resourceName: 'DailyActivity',
            fields: ['date', 'uploads', 'analyses', 'minutesOnline']
        });
    }

    public getTeamActivity = catchAsync(async (req: Request, res: Response) => {
        const { teamId } = req.params;
        const { range } = req.query;

        if (!teamId) {
            throw new RuntimeError(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 400);
        }

        const statsQuery: any = { team: new Types.ObjectId(teamId) };

        // Default range 365 days
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

        console.log(activities);

        res.status(200).json({
            status: 'success',
            data: activities
        });
    });
}
