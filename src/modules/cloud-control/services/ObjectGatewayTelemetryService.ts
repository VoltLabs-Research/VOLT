import { logger } from '@/core/logger';

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
}

interface CompleteObjectGatewayRequestInput {
    statusCode?: number;
    bytesIn?: number;
    bytesOut?: number;
    error?: unknown;
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
        private readonly telemetry: ObjectGatewayTelemetryService,
        private readonly operation: ObjectGatewayOperationName
    ) {
        this.telemetry.onRequestStarted();
    }

    markFirstByte(): void {
        if (typeof this.firstByteLatencyMs === 'number') {
            return;
        }

        this.firstByteLatencyMs = Date.now() - this.startedAt;
    }

    complete(input: CompleteObjectGatewayRequestInput = {}): void {
        if (this.completed) {
            return;
        }

        this.completed = true;
        this.telemetry.onRequestCompleted({
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

export class ObjectGatewayTelemetryService {
    private readonly operationStats = new Map<ObjectGatewayOperationName, ObjectGatewayOperationStats>();
    private readonly statusCounts = new Map<number, number>();
    private activeRequests = 0;
    private activeObjectTunnels = 0;
    private totalTunnelOpens = 0;
    private totalTunnelOpenLatencyMs = 0;
    private changedSinceLastSummary = false;

    constructor() {
        const timer = setInterval(() => {
            this.flushSummary();
        }, TELEMETRY_LOG_INTERVAL_MS);

        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    beginRequest(operation: ObjectGatewayOperationName): ObjectGatewayRequestTracker {
        return new ObjectGatewayRequestTracker(this, operation);
    }

    onRequestStarted(): void {
        this.activeRequests += 1;
        this.changedSinceLastSummary = true;
    }

    recordObjectTunnelOpened(durationMs: number): void {
        this.activeObjectTunnels += 1;
        this.totalTunnelOpens += 1;
        this.totalTunnelOpenLatencyMs += durationMs;
        this.changedSinceLastSummary = true;

        logger.info({
            action: 'object-gateway.tunnel-open',
            durationMs,
            activeObjectTunnels: this.activeObjectTunnels
        }, 'Opened daemon object gateway tunnel');
    }

    recordObjectTunnelClosed(): void {
        this.activeObjectTunnels = Math.max(0, this.activeObjectTunnels - 1);
        this.changedSinceLastSummary = true;
    }

    onRequestCompleted(input: {
        operation: ObjectGatewayOperationName;
        durationMs: number;
        firstByteLatencyMs?: number;
        statusCode?: number;
        bytesIn?: number;
        bytesOut?: number;
        error?: unknown;
    }): void {
        this.activeRequests = Math.max(0, this.activeRequests - 1);

        const stats = this.getOperationStats(input.operation);
        stats.count += 1;
        stats.totalDurationMs += input.durationMs;
        stats.totalBytesIn += input.bytesIn ?? 0;
        stats.totalBytesOut += input.bytesOut ?? 0;

        if (typeof input.firstByteLatencyMs === 'number') {
            stats.totalFirstByteLatencyMs += input.firstByteLatencyMs;
            stats.firstByteSamples += 1;
        }

        if (input.error || (typeof input.statusCode === 'number' && input.statusCode >= 400)) {
            stats.errorCount += 1;
        }

        if (typeof input.statusCode === 'number') {
            this.statusCounts.set(input.statusCode, (this.statusCounts.get(input.statusCode) ?? 0) + 1);
        }

        this.changedSinceLastSummary = true;

        logger.info({
            action: 'object-gateway.server.request',
            operation: input.operation,
            statusCode: input.statusCode,
            durationMs: input.durationMs,
            firstByteLatencyMs: input.firstByteLatencyMs,
            bytesIn: input.bytesIn ?? 0,
            bytesOut: input.bytesOut ?? 0,
            error: input.error instanceof Error ? input.error.message : undefined
        }, 'Completed object gateway server request');
    }

    private getOperationStats(operation: ObjectGatewayOperationName): ObjectGatewayOperationStats {
        const existing = this.operationStats.get(operation);
        if (existing) {
            return existing;
        }

        const next = createEmptyStats();
        this.operationStats.set(operation, next);
        return next;
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
            action: 'object-gateway.server.summary',
            activeRequests: this.activeRequests,
            activeObjectTunnels: this.activeObjectTunnels,
            totalTunnelOpens: this.totalTunnelOpens,
            avgTunnelOpenLatencyMs: this.totalTunnelOpens > 0
                ? Math.round((this.totalTunnelOpenLatencyMs / this.totalTunnelOpens) * 100) / 100
                : 0,
            statusCounts: Object.fromEntries(this.statusCounts.entries()),
            operations
        }, 'Object gateway daemon telemetry summary');

        this.changedSinceLastSummary = false;
    }
}
