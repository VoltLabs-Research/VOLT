import logger from '@shared/infrastructure/logger';

type ObjectGatewayOperationName =
    | 'list'
    | 'head'
    | 'get'
    | 'put'
    | 'delete'
    | 'delete-prefix';

interface ObjectGatewayOperationStats {
    count: number;
    errorCount: number;
    totalDurationMs: number;
    totalBytesIn: number;
    totalBytesOut: number;
    totalFirstByteLatencyMs: number;
    firstByteSamples: number;
};

interface CompleteObjectGatewayRequestMetricsInput {
    statusCode?: number;
    bytesIn?: number;
    bytesOut?: number;
    error?: unknown;
}

interface ObjectGatewaySessionDestroyedInput {
    ephemeral: boolean;
    wasInUse: boolean;
}

const TELEMETRY_LOG_INTERVAL_MS = 60_000;

const createEmptyStats = (): ObjectGatewayOperationStats => ({
    count: 0,
    errorCount: 0,
    totalDurationMs: 0,
    totalBytesIn: 0,
    totalBytesOut: 0,
    totalFirstByteLatencyMs: 0,
    firstByteSamples: 0
});

class ObjectGatewayRequestTracker {
    private readonly startedAt = Date.now();
    private firstByteLatencyMs: number | undefined;
    private completed = false;

    constructor(
        private readonly telemetry: ObjectGatewayClientTelemetry,
        private readonly operation: ObjectGatewayOperationName,
        private readonly teamClusterId: string
    ) {
        this.telemetry.incrementActiveRequests();
    }

    markFirstByte(): void {
        if (typeof this.firstByteLatencyMs === 'number') {
            return;
        }

        this.firstByteLatencyMs = Date.now() - this.startedAt;
    }

    complete(input: CompleteObjectGatewayRequestMetricsInput = {}): void {
        if (this.completed) {
            return;
        }

        this.completed = true;
        this.telemetry.recordRequestCompletion({
            teamClusterId: this.teamClusterId,
            operation: this.operation,
            durationMs: Date.now() - this.startedAt,
            firstByteLatencyMs: this.firstByteLatencyMs,
            statusCode: input.statusCode,
            bytesIn: input.bytesIn,
            bytesOut: input.bytesOut,
            error: input.error
        });
    }
}

export class ObjectGatewayClientTelemetry {
    private readonly operationStats = new Map<ObjectGatewayOperationName, ObjectGatewayOperationStats>();
    private readonly statusCounts = new Map<number, number>();
    private activeRequests = 0;
    private activeSessions = 0;
    private pooledSessions = 0;
    private totalTunnelOpens = 0;
    private totalTunnelOpenLatencyMs = 0;
    private sessionReuseCount = 0;
    private ephemeralSessionsCreated = 0;
    private changedSinceLastSummary = false;

    constructor() {
        const timer = setInterval(() => {
            this.flushSummary();
        }, TELEMETRY_LOG_INTERVAL_MS);

        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    beginRequest(operation: ObjectGatewayOperationName, teamClusterId: string): ObjectGatewayRequestTracker {
        return new ObjectGatewayRequestTracker(this, operation, teamClusterId);
    }

    incrementActiveRequests(): void {
        this.activeRequests += 1;
        this.changedSinceLastSummary = true;
    }

    recordTunnelOpened(teamClusterId: string, exposureId: string, durationMs: number, ephemeral: boolean): void {
        this.totalTunnelOpens += 1;
        this.totalTunnelOpenLatencyMs += durationMs;
        this.changedSinceLastSummary = true;

        logger.info({
            action: 'object-gateway.client.tunnel-open',
            teamClusterId,
            exposureId,
            durationMs,
            ephemeral
        }, 'Opened object gateway tunnel');
    }

    recordSessionReused(): void {
        this.sessionReuseCount += 1;
        this.activeSessions += 1;
        this.changedSinceLastSummary = true;
    }

    recordSessionOpened(ephemeral: boolean): void {
        this.activeSessions += 1;
        if (ephemeral) {
            this.ephemeralSessionsCreated += 1;
        } else {
            this.pooledSessions += 1;
        }

        this.changedSinceLastSummary = true;
    }

    recordSessionReleased(): void {
        this.activeSessions = Math.max(0, this.activeSessions - 1);
        this.changedSinceLastSummary = true;
    }

    recordSessionDestroyed(input: ObjectGatewaySessionDestroyedInput): void {
        if (input.wasInUse) {
            this.activeSessions = Math.max(0, this.activeSessions - 1);
        }

        if (!input.ephemeral) {
            this.pooledSessions = Math.max(0, this.pooledSessions - 1);
        }

        this.changedSinceLastSummary = true;
    }

    private getOperationStats(operation: ObjectGatewayOperationName): ObjectGatewayOperationStats {
        const existingStats = this.operationStats.get(operation);
        if (existingStats) {
            return existingStats;
        }

        const nextStats = createEmptyStats();
        this.operationStats.set(operation, nextStats);
        return nextStats;
    }

    recordRequestCompletion(input: {
        teamClusterId: string;
        operation: ObjectGatewayOperationName;
        durationMs: number;
        firstByteLatencyMs?: number;
        statusCode?: number;
        bytesIn?: number;
        bytesOut?: number;
        error?: unknown;
    }): void {
        this.activeRequests = Math.max(0, this.activeRequests - 1);

        const operationStats = this.getOperationStats(input.operation);
        operationStats.count += 1;
        operationStats.totalDurationMs += input.durationMs;
        operationStats.totalBytesIn += input.bytesIn ?? 0;
        operationStats.totalBytesOut += input.bytesOut ?? 0;

        if (typeof input.firstByteLatencyMs === 'number') {
            operationStats.totalFirstByteLatencyMs += input.firstByteLatencyMs;
            operationStats.firstByteSamples += 1;
        }

        if (input.error || (typeof input.statusCode === 'number' && input.statusCode >= 400)) {
            operationStats.errorCount += 1;
        }

        if (typeof input.statusCode === 'number') {
            this.statusCounts.set(input.statusCode, (this.statusCounts.get(input.statusCode) ?? 0) + 1);
        }

        this.changedSinceLastSummary = true;

        logger.info({
            action: 'object-gateway.client.request',
            teamClusterId: input.teamClusterId,
            operation: input.operation,
            statusCode: input.statusCode,
            durationMs: input.durationMs,
            firstByteLatencyMs: input.firstByteLatencyMs,
            bytesIn: input.bytesIn ?? 0,
            bytesOut: input.bytesOut ?? 0,
            error: input.error instanceof Error ? input.error.message : undefined
        }, 'Completed object gateway client request');
    }

    private flushSummary(): void {
        if (!this.changedSinceLastSummary) {
            return;
        }

        const operations = Object.fromEntries(
            Array.from(this.operationStats.entries()).map(([operation, stats]) => [
                operation,
                {
                    count: stats.count,
                    errorCount: stats.errorCount,
                    avgDurationMs: stats.count > 0
                        ? Math.round((stats.totalDurationMs / stats.count) * 100) / 100
                        : 0,
                    avgFirstByteLatencyMs: stats.firstByteSamples > 0
                        ? Math.round((stats.totalFirstByteLatencyMs / stats.firstByteSamples) * 100) / 100
                        : undefined,
                    totalBytesIn: stats.totalBytesIn,
                    totalBytesOut: stats.totalBytesOut
                }
            ])
        );

        logger.info({
            action: 'object-gateway.client.summary',
            activeRequests: this.activeRequests,
            activeSessions: this.activeSessions,
            pooledSessions: this.pooledSessions,
            sessionReuseCount: this.sessionReuseCount,
            ephemeralSessionsCreated: this.ephemeralSessionsCreated,
            totalTunnelOpens: this.totalTunnelOpens,
            avgTunnelOpenLatencyMs: this.totalTunnelOpens > 0
                ? Math.round((this.totalTunnelOpenLatencyMs / this.totalTunnelOpens) * 100) / 100
                : 0,
            statusCounts: Object.fromEntries(this.statusCounts.entries()),
            operations
        }, 'Object gateway client telemetry summary');

        this.changedSinceLastSummary = false;
    }
}

export const objectGatewayClientTelemetry = new ObjectGatewayClientTelemetry();
