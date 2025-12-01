import { Request, Response } from 'express';
import MetricsCollector from '@/services/metrics-collector';
import catchAsync from '@/utilities/catch-async';

const metricsCollector = new MetricsCollector();

export const getSystemStats = catchAsync(async (req: Request, res: Response) => {
    // Try to get cached metrics from Redis first (fastest)
    let stats = await metricsCollector.getLatestFromRedis();

    // If no cached metrics, collect them now (slower but accurate)
    if (!stats) {
        stats = await metricsCollector.collect();
    }

    res.status(200).json({
        status: 'success',
        data: {
            stats
        }
    });
});
