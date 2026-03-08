import mongoose from 'mongoose';
import { injectable } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { MongoDBMetrics } from '@modules/system/domain/value-objects/SystemMetrics';

@injectable()
export default class MongoMetricsCollector {
    async collect(): Promise<MongoDBMetrics | null> {
        try {
            const db = mongoose.connection.db;
            if (!db) return null;

            const adminDb = db.admin();
            const serverStatus = await adminDb.serverStatus();

            const opcounters = serverStatus.opcounters || {};
            const queries = (opcounters.query || 0) + (opcounters.getmore || 0);

            const readLatency = serverStatus.opLatencies?.reads || { latency: 0, ops: 1 };
            const latencyMs = readLatency.ops > 0
                ? Math.round(readLatency.latency / readLatency.ops / 1000)
                : 0;

            return {
                connections: serverStatus.connections?.current || 0,
                queries,
                latency: Math.max(0, latencyMs)
            };
        } catch (error: unknown) {
            logger.error(`Error collecting MongoDB metrics: ${error}`);
            return null;
        }
    }
}
