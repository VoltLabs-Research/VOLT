type SocketErrorContext =
    | { kind: 'emit'; event: string }
    | { kind: 'subscribe'; event: string; roomKey?: string };

interface SocketErrorReport {
    error: unknown;
    context: SocketErrorContext;
    timestamp: number;
}

const DEDUP_WINDOW_MS = 5_000;

const isDevEnvironment = (): boolean => {
    try {
        return Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
    } catch {
        return false;
    }
};

const buildContextKey = (context: SocketErrorContext): string => {
    if (context.kind === 'emit') return `emit:${context.event}`;
    return `subscribe:${context.event}:${context.roomKey ?? ''}`;
};

const extractMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error ?? 'unknown');
};

class SocketErrorReporterImpl {
    private lastReportTimestamps = new Map<string, number>();
    private logger: (report: SocketErrorReport) => void;

    constructor() {
        this.logger = (report) => {
            if (!isDevEnvironment()) return;
            console.warn('[socket]', report.context, report.error);
        };
    }

    report(error: unknown, context: SocketErrorContext): void {
        const dedupKey = `${buildContextKey(context)}:${extractMessage(error)}`;
        const now = Date.now();
        const previousTimestamp = this.lastReportTimestamps.get(dedupKey) ?? 0;

        if (now - previousTimestamp < DEDUP_WINDOW_MS) {
            return;
        }

        this.lastReportTimestamps.set(dedupKey, now);

        const report: SocketErrorReport = {
            error,
            context,
            timestamp: now
        };

        try {
            this.logger(report);
        } catch {
        }
    }
};

export const socketErrorReporter = new SocketErrorReporterImpl();
