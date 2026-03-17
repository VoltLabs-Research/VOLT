import { logger } from './logger';
import v8 from 'node:v8';

/**
 * Heap memory pressure thresholds (percentage of heap limit).
 * Warnings are emitted at each threshold via structured logging.
 */
const THRESHOLDS = [
    { pct: 0.50, label: 'heap-50%' },
    { pct: 0.70, label: 'heap-70%' },
    { pct: 0.85, label: 'heap-85%' }
] as const;

/** Above this fraction of the heap limit, new heavy work should be delayed. */
const PRESSURE_THRESHOLD = 0.75;

/** Interval between periodic heap checks (ms). */
const MONITOR_INTERVAL_MS = 10_000;

let monitorTimer: ReturnType<typeof setInterval> | null = null;
let lastTriggeredIndex = -1;

const getHeapStats = (): { heapUsed: number; heapLimit: number; ratio: number } => {
    const stats = v8.getHeapStatistics();
    const heapUsed = stats.used_heap_size;
    const heapLimit = stats.heap_size_limit;
    return { heapUsed, heapLimit, ratio: heapUsed / heapLimit };
};

/**
 * Returns `true` when the V8 heap is above the pressure threshold.
 * Workers should call this before starting heavy work and requeue/delay if true.
 */
export const isMemoryPressured = (): boolean => {
    const { ratio } = getHeapStats();
    return ratio >= PRESSURE_THRESHOLD;
};

/**
 * Returns current heap usage as a fraction of the heap limit (0-1).
 */
export const getHeapUsageRatio = (): number => {
    return getHeapStats().ratio;
};

const checkAndLogThresholds = (): void => {
    const { heapUsed, heapLimit, ratio } = getHeapStats();

    // Find the highest threshold that's currently exceeded
    let highestIndex = -1;
    for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
        if (ratio >= THRESHOLDS[i].pct) {
            highestIndex = i;
            break;
        }
    }

    // Only log when we cross into a new (higher) threshold band, or drop below all
    if (highestIndex > lastTriggeredIndex) {
        const threshold = THRESHOLDS[highestIndex];
        const level = highestIndex >= 2 ? 'error' : highestIndex >= 1 ? 'warn' : 'info';
        logger[level](
            {
                threshold: threshold.label,
                heapUsedMB: Math.round(heapUsed / 1024 / 1024),
                heapLimitMB: Math.round(heapLimit / 1024 / 1024),
                heapUsagePct: Math.round(ratio * 100)
            },
            `Memory threshold crossed: ${threshold.label}`
        );
        lastTriggeredIndex = highestIndex;
    } else if (highestIndex < lastTriggeredIndex) {
        // Heap dropped below the previously triggered threshold — reset
        lastTriggeredIndex = highestIndex;
        if (highestIndex >= 0) {
            logger.info(
                {
                    threshold: THRESHOLDS[highestIndex].label,
                    heapUsedMB: Math.round(heapUsed / 1024 / 1024),
                    heapLimitMB: Math.round(heapLimit / 1024 / 1024),
                    heapUsagePct: Math.round(ratio * 100)
                },
                'Memory pressure decreased'
            );
        }
    }
};

/**
 * Starts the periodic heap monitor. Safe to call multiple times (idempotent).
 */
export const startMemoryMonitor = (): void => {
    if (monitorTimer) return;

    const { heapLimit } = getHeapStats();
    logger.info(
        { heapLimitMB: Math.round(heapLimit / 1024 / 1024) },
        'Memory monitor started'
    );

    monitorTimer = setInterval(checkAndLogThresholds, MONITOR_INTERVAL_MS);
    monitorTimer.unref(); // Don't prevent process exit
};

/**
 * Stops the periodic heap monitor.
 */
export const stopMemoryMonitor = (): void => {
    if (monitorTimer) {
        clearInterval(monitorTimer);
        monitorTimer = null;
    }
};
