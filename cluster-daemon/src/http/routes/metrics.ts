import { sendSuccess } from '../common';
import express from 'express';
import type { MetricsService } from '../../modules/metrics/MetricsService';

export const createMetricsRouter = (metricsService: MetricsService) => {
    const router = express.Router();

    router.get('/api/metrics/snapshot', async (_req, res) => {
        sendSuccess(res, await metricsService.collectSnapshot());
    });

    return router;
};
