import { Request, Response } from 'express';
import { Analysis, Team, Trajectory } from '@/models';
import { catchAsync } from '@/utilities/runtime/runtime';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { Action } from '@/constants/permissions';
import { Resource } from '@/constants/resources';
import BaseController from '@/controllers/base-controller';
import logger from '@/logger';

export default class AnalysisConfigController extends BaseController<any> {
    constructor() {
        super(Analysis, {
            resource: Resource.ANALYSIS,
            fields: []
        });
    }

    public listByTeam = catchAsync(async (req: Request, res: Response) => {
        const { teamId } = req.params;
        const { page = '1', limit = '20', q = '' } = req.query as Record<string, string>;

        const trajectories = await Trajectory.find({ team: teamId }).select('_id name').lean();
        const trajectoryIds = trajectories.map((t: any) => t._id);

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        const query = typeof q === 'string' ? q.trim() : '';
        const regex = query ?
            { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
            : null;

        const pipeline: any[] = [{
            $match: { trajectory: { $in: trajectoryIds } }
        }];

        if (regex) {
            pipeline.push({
                $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' }
            }, {
                $addFields: { trajectoryDoc: { $arrayElemAt: ['$trajectoryDoc', 0] } }
            }, {
                $match: {
                    $or: [
                        { identificationMode: regex },
                        { crystalStructure: regex },
                        { 'trajectoryDoc.name': regex }
                    ]
                }
            });
        }

        pipeline.push(
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    plugin: 1,
                    modifier: 1,
                    totalFrames: { $ifNull: ['$totalFrames', 0] },
                    completedFrames: { $ifNull: ['$completedFrames', 0] },
                    startedAt: 1,
                    finishedAt: 1,
                    createdAt: 1,
                    trajectory: 1
                }
            },
            { $skip: skip },
            { $limit: limitNum },
            { $lookup: { from: 'trajectories', localField: 'trajectory', foreignField: '_id', as: 'trajectoryDoc' } },
            { $addFields: { trajectory: { $let: { vars: { t: { $arrayElemAt: ['$trajectoryDoc', 0] } }, in: { _id: '$$t._id', name: '$$t.name' } } } } },
            { $project: { trajectoryDoc: 0 } }
        );

        let configs: any[] = [];
        let total = 0;

        try {
            if (regex) {
                const countPipeline = [...pipeline.slice(0, 4), { $count: 'total' }];
                const [rows, countRows] = await Promise.all([
                    Analysis.aggregate(pipeline),
                    Analysis.aggregate(countPipeline)
                ]);
                configs = rows;
                total = countRows[0]?.total || 0;
            } else {
                const [rows, count] = await Promise.all([
                    Analysis.aggregate(pipeline),
                    Analysis.countDocuments({ trajectory: { $in: trajectoryIds } })
                ]);
                configs = rows;
                total = count;
            }

            res.status(200).json({
                status: 'success',
                data: { configs, total, page: pageNum, limit: limitNum }
            });
        } catch (err: any) {
            logger.error(`listAnalysisConfigsByTeam error: ${err}`);
            throw new RuntimeError(ErrorCodes.ANALYSIS_EXECUTION_FAILED, 500);
        }
    })
};
