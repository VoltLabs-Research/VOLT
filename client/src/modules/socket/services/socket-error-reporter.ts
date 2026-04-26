export type SocketErrorContext =
    | { kind: 'emit'; event: string }
    | { kind: 'connect'; attempt?: number; transport?: string }
    | { kind: 'subscribe'; event: string; roomKey?: string };

export interface SocketErrorReport {
    error: unknown;
    context: SocketErrorContext;
    timestamp: number;
}

export interface SocketErrorReporterConfig {
    logger?: (report: SocketErrorReport) => void;
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
    if (context.kind === 'subscribe') return `subscribe:${context.event}:${context.roomKey ?? ''}`;
    return `connect:${context.transport ?? ''}`;
};

const extractMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error ?? 'unknown');
};

class SocketErrorReporterImpl {
    private listeners = new Set<(report: SocketErrorReport) => void>();
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

        this.listeners.forEach((listener) => {
            try {
                listener(report);
            } catch {
            }
        });
    }

    subscribe(listener: (report: SocketErrorReport) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    configure(config: SocketErrorReporterConfig): void {
        if (config.logger) {
            this.logger = config.logger;
        }
    }
};

export const socketErrorReporter = new SocketErrorReporterImpl();
