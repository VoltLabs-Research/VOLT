import { logger } from './logger';
import { getEffectiveMemoryLimitBytes } from '@/shared/utilities/runtime-capacity';
import v8 from 'node:v8';

/**
 * Heap memory pressure thresholds (percentage of heap limit).
 * Warnings are emitted at each threshold via structured logging.
 * When `gc` is true the monitor will attempt a manual GC cycle at that level.
 */
const THRESHOLDS = [
    { pct: 0.50, label: 'heap-50%', gc: false },
    { pct: 0.70, label: 'heap-70%', gc: true },
    { pct: 0.85, label: 'heap-85%', gc: true }
] as const;

/** Above this fraction of the heap limit, new heavy work should be delayed. */
const PRESSURE_THRESHOLD = 0.75;
const RSS_PRESSURE_THRESHOLD = 0.8;

/** Interval between periodic heap checks (ms). */
const MONITOR_INTERVAL_MS = 10_000;

/** Minimum interval between manual GC invocations to avoid thrashing (ms). */
const GC_COOLDOWN_MS = 30_000;

let monitorTimer: ReturnType<typeof setInterval> | null = null;
let lastTriggeredIndex = -1;
let lastGcTimestamp = 0;
let rssPressureTriggered = false;

const getHeapStats = (): {
    heapUsed: number;
    heapLimit: number;
    ratio: number;
    rss: number;
    rssLimit: number;
    rssRatio: number;
} => {
    const stats = v8.getHeapStatistics();
    const usage = process.memoryUsage();
    const rssLimit = getEffectiveMemoryLimitBytes();
    const heapUsed = stats.used_heap_size;
    const heapLimit = stats.heap_size_limit;
    const rss = usage.rss;

    return {
        heapUsed,
        heapLimit,
        ratio: heapUsed / heapLimit,
        rss,
        rssLimit,
        rssRatio: rss / rssLimit
    };
};

/**
 * Returns `true` when the V8 heap is above the pressure threshold.
 * Workers should call this before starting heavy work and requeue/delay if true.
 */
export const isMemoryPressured = (): boolean => {
    const { ratio, rssRatio } = getHeapStats();
    return ratio >= PRESSURE_THRESHOLD || rssRatio >= RSS_PRESSURE_THRESHOLD;
};

/**
 * Returns current heap usage as a fraction of the heap limit (0-1).
 */
export const getHeapUsageRatio = (): number => {
    return getHeapStats().ratio;
};

/**
 * Attempts a manual V8 garbage collection cycle.
 * Requires `--expose-gc` (injected by scripts/start.js).
 * Returns `true` if GC was triggered, `false` if unavailable or on cooldown.
 */
export const tryForceGC = (): boolean => {
    if (typeof global.gc !== 'function') {
        return false;
    }

    const now = Date.now();
    if (now - lastGcTimestamp < GC_COOLDOWN_MS) {
        return false;
    }

    lastGcTimestamp = now;
    global.gc();
    return true;
};

/**
 * Unconditional GC — bypasses the cooldown timer.
 * Use this in critical memory paths (e.g. between exposure processing passes)
 * where we *know* large allocations just became unreachable and we need the
 * heap reclaimed before the next heavy allocation.
 *
 * Returns `true` if GC was triggered, `false` if `--expose-gc` is unavailable.
 */
export const forceGC = (): boolean => {
    if (typeof global.gc !== 'function') {
        return false;
    }

    lastGcTimestamp = Date.now();
    global.gc();
    return true;
};

const checkAndLogThresholds = (): void => {
    const { heapUsed, heapLimit, ratio, rss, rssLimit, rssRatio } = getHeapStats();

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
                heapUsagePct: Math.round(ratio * 100),
                rssMB: Math.round(rss / 1024 / 1024),
                rssLimitMB: Math.round(rssLimit / 1024 / 1024),
                rssUsagePct: Math.round(rssRatio * 100)
            },
            `Memory threshold crossed: ${threshold.label}`
        );

        // Attempt a manual GC cycle when crossing into a high-pressure band
        if (threshold.gc) {
            const didGc = tryForceGC();
            if (didGc) {
                const after = getHeapStats();
                logger.info(
                    {
                        heapUsedMB: Math.round(after.heapUsed / 1024 / 1024),
                        heapUsagePct: Math.round(after.ratio * 100),
                        rssMB: Math.round(after.rss / 1024 / 1024),
                        rssUsagePct: Math.round(after.rssRatio * 100)
                    },
                    'Manual GC triggered by memory monitor'
                );
            }
        }

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
                    heapUsagePct: Math.round(ratio * 100),
                    rssMB: Math.round(rss / 1024 / 1024),
                    rssLimitMB: Math.round(rssLimit / 1024 / 1024),
                    rssUsagePct: Math.round(rssRatio * 100)
                },
                'Memory pressure decreased'
            );
        }
    }

    if (rssRatio >= RSS_PRESSURE_THRESHOLD && !rssPressureTriggered) {
        rssPressureTriggered = true;
        logger.warn(
            {
                rssMB: Math.round(rss / 1024 / 1024),
                rssLimitMB: Math.round(rssLimit / 1024 / 1024),
                rssUsagePct: Math.round(rssRatio * 100),
                heapUsedMB: Math.round(heapUsed / 1024 / 1024),
                heapUsagePct: Math.round(ratio * 100)
            },
            'RSS memory pressure threshold crossed'
        );
    } else if (rssRatio < RSS_PRESSURE_THRESHOLD && rssPressureTriggered) {
        rssPressureTriggered = false;
        logger.info(
            {
                rssMB: Math.round(rss / 1024 / 1024),
                rssLimitMB: Math.round(rssLimit / 1024 / 1024),
                rssUsagePct: Math.round(rssRatio * 100)
            },
            'RSS memory pressure decreased'
        );
    }
};

/**
 * Starts the periodic heap monitor. Safe to call multiple times (idempotent).
 */
export const startMemoryMonitor = (): void => {
    if (monitorTimer) return;

    const { heapLimit, rssLimit } = getHeapStats();
    const gcAvailable = typeof global.gc === 'function';
    logger.info(
        {
            heapLimitMB: Math.round(heapLimit / 1024 / 1024),
            rssLimitMB: Math.round(rssLimit / 1024 / 1024),
            gcAvailable
        },
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
