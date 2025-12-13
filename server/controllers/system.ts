import { Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import MetricsCollector from '@/services/metrics-collector';

const metricsCollector = new MetricsCollector();

export default class SystemController{
    public getSystemStats = catchAsync(async(_req: Request, res: Response) => {
        let stats = await metricsCollector.getLatestFromRedis();

        if(!stats){
            stats = await metricsCollector.collect();
        }

        res.status(200).json({
            status: 'success',
            data: {
                stats
            }
        });
    });
}
