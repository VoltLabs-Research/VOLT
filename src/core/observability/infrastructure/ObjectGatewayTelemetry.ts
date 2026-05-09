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

interface ObjectGatewayRequestCompletionInput {
    statusCode?: number;
    bytesIn?: number;
    bytesOut?: number;
    hasError?: boolean;
}

interface ObjectGatewayRequestSummary extends ObjectGatewayRequestCompletionInput {
    operation: ObjectGatewayOperationName;
    durationMs: number;
    firstByteLatencyMs?: number;
}

interface ObjectGatewayRequestTracker {
    markFirstByte(): void;
    complete(input?: ObjectGatewayRequestCompletionInput): void;
}

const TELEMETRY_LOG_INTERVAL_MS = 60_000;

export class ObjectGatewayTelemetry {
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

        timer.unref();
    }

    beginRequest(operation: ObjectGatewayOperationName): ObjectGatewayRequestTracker {
        const startedAt = Date.now();
        let firstByteLatencyMs: number | undefined;
        let completed = false;

        this.activeRequests += 1;
        this.changedSinceLastSummary = true;

        return {
            markFirstByte: () => {
                if (firstByteLatencyMs !== undefined) {
                    return;
                }

                firstByteLatencyMs = Date.now() - startedAt;
            },
            complete: (input: ObjectGatewayRequestCompletionInput = {}) => {
                if (completed) {
                    return;
                }

                completed = true;
                this.onRequestCompleted({
                    operation,
                    durationMs: Date.now() - startedAt,
                    firstByteLatencyMs,
                    statusCode: input.statusCode,
                    bytesIn: input.bytesIn,
                    bytesOut: input.bytesOut,
                    hasError: input.hasError
                });
            }
        };
    }

    recordObjectTunnelOpened(durationMs: number): void {
        this.activeObjectTunnels += 1;
        this.totalTunnelOpens += 1;
        this.totalTunnelOpenLatencyMs += durationMs;
        this.changedSinceLastSummary = true;
    }

    readonly recordObjectTunnelClosed = (): void => {
        this.activeObjectTunnels = Math.max(0, this.activeObjectTunnels - 1);
        this.changedSinceLastSummary = true;
    };

    onRequestCompleted(input: ObjectGatewayRequestSummary): void {
        this.activeRequests = Math.max(0, this.activeRequests - 1);
        const { statusCode } = input;

        const stats = this.getOperationStats(input.operation);
        stats.count += 1;
        stats.totalDurationMs += input.durationMs;
        stats.totalBytesIn += input.bytesIn ?? 0;
        stats.totalBytesOut += input.bytesOut ?? 0;

        if (input.firstByteLatencyMs !== undefined) {
            stats.totalFirstByteLatencyMs += input.firstByteLatencyMs;
            stats.firstByteSamples += 1;
        }

        if (input.hasError || (statusCode !== undefined && statusCode >= 400)) {
            stats.errorCount += 1;
        }

        if (statusCode !== undefined) {
            this.statusCounts.set(statusCode, (this.statusCounts.get(statusCode) ?? 0) + 1);
        }

        this.changedSinceLastSummary = true;
    }

    private getOperationStats(operation: ObjectGatewayOperationName): ObjectGatewayOperationStats {
        const existing = this.operationStats.get(operation);
        if (existing) {
            return existing;
        }

        const next: ObjectGatewayOperationStats = {
            count: 0,
            errorCount: 0,
            totalDurationMs: 0,
            totalBytesIn: 0,
            totalBytesOut: 0,
            totalFirstByteLatencyMs: 0,
            firstByteSamples: 0
        };
        this.operationStats.set(operation, next);
        return next;
    }

    private flushSummary(): void {
        if (!this.changedSinceLastSummary) {
            return;
        }

        this.changedSinceLastSummary = false;
    }
}
