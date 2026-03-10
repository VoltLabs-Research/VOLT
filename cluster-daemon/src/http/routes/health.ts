import { RuntimeLifecycleEventType } from '../../contracts/events';
import { sendSuccess } from '../common';
import express from 'express';
import type { DaemonHealthResponse } from '../../contracts/http';
import type { RuntimeEventBroker } from '../../infrastructure/RuntimeEventBroker';
import type { MetricsService } from '../../modules/metrics/MetricsService';

const isDaemonReady = (latestLifecycleEvent: ReturnType<RuntimeEventBroker['getLatestLifecycleEvent']>): boolean => {
    if (!latestLifecycleEvent) {
        return false;
    }

    return latestLifecycleEvent.type === RuntimeLifecycleEventType.ServicesReady
        || latestLifecycleEvent.type === RuntimeLifecycleEventType.HeartbeatSucceeded
        || latestLifecycleEvent.type === RuntimeLifecycleEventType.HeartbeatFailed
        || latestLifecycleEvent.type === RuntimeLifecycleEventType.CloudSocketConnected
        || latestLifecycleEvent.type === RuntimeLifecycleEventType.CloudSocketDisconnected;
};

export const createHealthRouter = (
    metricsService: MetricsService,
    eventBroker: RuntimeEventBroker
) => {
    const router = express.Router();

    router.get('/health', async (_req, res) => {
        const metrics = await metricsService.collectSnapshot();
        const latestLifecycleEvent = eventBroker.getLatestLifecycleEvent();
        const response: DaemonHealthResponse = {
            ok: true,
            ready: isDaemonReady(latestLifecycleEvent),
            metrics,
            latestLifecycleEvent
        };

        sendSuccess(res, response);
    });

    return router;
};
