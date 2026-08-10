import fs from 'node:fs/promises';
import path from 'node:path';
import { DAEMON_PATHS } from '@core/config/paths';

/** Keeps the on-disk plugin parquet cache under its byte budget, evicting the oldest files first. */

const CACHE_MAX_BYTES = Math.max(
    0,
    Number(process.env.DAEMON_PLUGIN_PARQUET_CACHE_MAX_BYTES) || 4 * 1024 * 1024 * 1024
);
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MIN_EVICT_AGE_MS = 60 * 1000;

let lastSweepAt = 0;
let sweepInFlight = false;

export const sweepPluginParquetCache = async (): Promise<void> => {
    if (CACHE_MAX_BYTES <= 0) return;
    const now = Date.now();
    if (sweepInFlight || now - lastSweepAt < SWEEP_INTERVAL_MS) {
        return;
    }
    sweepInFlight = true;
    lastSweepAt = now;
    try {
        const dir = DAEMON_PATHS.pluginParquetCache;
        const entries = await fs.readdir(dir);
        const stats = await Promise.all(
            entries
                .filter((name) => name.endsWith('.parquet'))
                .map(async (name) => {
                    const filePath = path.join(dir, name);
                    const stat = await fs.stat(filePath);
                    return {
                        filePath,
                        size: stat.size,
                        mtimeMs: stat.mtimeMs
                    };
                })
        );

        let totalBytes = stats.reduce((sum, entry) => sum + entry.size, 0);
        if (totalBytes <= CACHE_MAX_BYTES) return;

        stats.sort((left, right) => left.mtimeMs - right.mtimeMs);
        for (const entry of stats) {
            if (totalBytes <= CACHE_MAX_BYTES) break;
            if (now - entry.mtimeMs < MIN_EVICT_AGE_MS) continue;
            await fs.rm(entry.filePath, { force: true });
            await fs.rm(`${entry.filePath}.signature`, { force: true });
            totalBytes -= entry.size;
        }
    } catch {
    } finally {
        sweepInFlight = false;
    }
};
