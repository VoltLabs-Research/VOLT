import { Singleton } from '@shared/infrastructure/di/decorators';
import mongoose from 'mongoose';

import type { MongoDBMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import logger from '@shared/infrastructure/logger';

const MONGO_METRICS_CACHE_TTL_MS = 5_000;

@Singleton()
export default class MongoMetricsCollector {
    private cachedMetrics: {
        expiresAt: number;
        value: MongoDBMetrics | null;
    } | null = null;
    private pendingCollection: Promise<MongoDBMetrics | null> | null = null;

    async collect(): Promise<MongoDBMetrics | null> {
        const cachedMetrics = this.cachedMetrics;
        if (cachedMetrics && cachedMetrics.expiresAt > Date.now()) {
            return cachedMetrics.value;
        }

        if (this.pendingCollection) {
            return this.pendingCollection;
        }

        this.pendingCollection = (async () => {
            try {
                const db = mongoose.connection.db;
                if (!db) {
                    this.cachedMetrics = {
                        expiresAt: Date.now() + MONGO_METRICS_CACHE_TTL_MS,
                        value: null
                    };
                    return null;
                }

                const adminDb = db.admin();
                const serverStatus = await adminDb.serverStatus();

                const opcounters = serverStatus.opcounters || {};
                const queries = (opcounters.query || 0) + (opcounters.getmore || 0);

                const readLatency = serverStatus.opLatencies?.reads || { latency: 0, ops: 1 };
                const latencyMs = readLatency.ops > 0
                    ? Math.round(readLatency.latency / readLatency.ops / 1000)
                    : 0;
                const metrics: MongoDBMetrics = {
                    connections: serverStatus.connections?.current || 0,
                    queries,
                    latency: Math.max(0, latencyMs)
                };

                this.cachedMetrics = {
                    expiresAt: Date.now() + MONGO_METRICS_CACHE_TTL_MS,
                    value: metrics
                };

                return metrics;
            } catch (error: unknown) {
                logger.error(`Error collecting MongoDB metrics: ${error}`);
                return null;
            }
        })().finally(() => {
            this.pendingCollection = null;
        });

        return this.pendingCollection;
    }
}
