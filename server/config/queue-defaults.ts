/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Centralized configuration constants for the queue system.
 * These values can be overridden via environment variables.
 */
export const QUEUE_DEFAULTS = {
    /** Time-to-live for job status records in Redis (seconds) */
    TTL_SECONDS: parseInt(process.env.QUEUE_TTL_SECONDS || '86400', 10),

    /** Number of jobs to fetch in each batch */
    BATCH_SIZE: parseInt(process.env.QUEUE_BATCH_SIZE || '20', 10),

    /** Minimum number of workers to keep in the pool */
    MIN_WORKERS: parseInt(process.env.QUEUE_MIN_WORKERS || '1', 10),

    /** Time before an idle worker is terminated (milliseconds) */
    IDLE_WORKER_TTL_MS: parseInt(process.env.QUEUE_IDLE_WORKER_TTL_MS || '30000', 10),

    /** Window for detecting crash loops (milliseconds) */
    CRASH_WINDOW_MS: parseInt(process.env.QUEUE_CRASH_WINDOW_MS || '60000', 10),

    /** Maximum consecutive crashes before triggering crash-loop protection */
    MAX_CONSECUTIVE_CRASHES: parseInt(process.env.QUEUE_MAX_CONSECUTIVE_CRASHES || '5', 10),

    /** Backoff time between worker respawns during crash-loop (milliseconds) */
    CRASH_BACKOFF_MS: parseInt(process.env.QUEUE_CRASH_BACKOFF_MS || '5000', 10),

    /** Session TTL in Redis (7 days in seconds) */
    SESSION_TTL_SECONDS: parseInt(process.env.QUEUE_SESSION_TTL_SECONDS || '604800', 10),

    /** Startup lock TTL for recovery operations (milliseconds) */
    STARTUP_LOCK_TTL_MS: parseInt(process.env.QUEUE_STARTUP_LOCK_TTL_MS || '60000', 10),

    /** Default max memory for worker threads (MB) */
    WORKER_MAX_OLD_GENERATION_SIZE_MB: parseInt(process.env.QUEUE_WORKER_MAX_MEMORY_MB || '30000', 10),
} as const;

export type QueueDefaults = typeof QUEUE_DEFAULTS;
