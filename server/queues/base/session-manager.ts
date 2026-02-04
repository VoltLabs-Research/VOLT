import IORedis from 'ioredis';
import { BaseJob } from '@/types/queues/base-processing-queue';
import { publishJobUpdate } from '@/events/job-updates';
import { QUEUE_DEFAULTS } from '@/config/queue-defaults';
import logger from '@/logger';

export interface SessionManagerConfig {
    queueName: string;
    logPrefix: string;
}

/**
 * Manages job sessions including initialization, tracking, and cleanup.
 */
export class SessionManager<T extends BaseJob> {
    private sessionsBeingCleaned = new Set<string>();

    constructor(
        private readonly redis: IORedis,
        private readonly config: SessionManagerConfig
    ){}

    private logInfo(message: string): void {
        logger.info(`${this.config.logPrefix} ${message}`);
    }

    private logError(message: string): void {
        logger.error(`${this.config.logPrefix} ${message}`);
    }

    /**
     * Generate a unique session ID
     */
    generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Initialize a new session in Redis
     */
    async initializeSession(
        sessionId: string,
        sessionStartTime: string,
        jobCount: number,
        firstJob: T
    ): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        const counterKey = `session:${sessionId}:remaining`;

        await this.redis.pipeline()
            .setex(sessionKey, QUEUE_DEFAULTS.SESSION_TTL_SECONDS, JSON.stringify({
                sessionId,
                startTime: sessionStartTime,
                totalJobs: jobCount,
                trajectoryId: (firstJob as any).trajectoryId,
                teamId: firstJob.teamId,
                status: 'active'
            }))
            .set(counterKey, jobCount.toString())
            .expire(counterKey, QUEUE_DEFAULTS.SESSION_TTL_SECONDS)
            .exec();
    }

    /**
     * Execute cleanup script for a session
     * Returns [shouldClean, remaining, status]
     */
    async executeCleanupScript(
        sessionId: string,
        trajectoryId: string,
        teamId: string
    ): Promise<[number, number, string]> {
        const luaScript = `
            local sessionId = ARGV[1]
            local trajectoryId = ARGV[2]

            local sessionKey = "session:" .. sessionId
            local counterKey = sessionKey .. ":remaining"

            local remaining = redis.call('DECR', counterKey)

            if remaining <= 0 then
                redis.call('DEL', sessionKey)
                redis.call('DEL', counterKey)

                return {1, 0, "cleaned"}
            else
                return {0, remaining, "pending"}
            end
        `;

        return await this.redis.eval(
            luaScript,
            0,
            sessionId,
            trajectoryId
        ) as [number, number, string];
    }

    /**
     * Emit session completed event and perform cleanup
     */
    async emitSessionCompleted(
        teamId: string,
        sessionId: string,
        trajectoryId: string
    ): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.redis.get(sessionKey);

        if (!sessionData) {
            logger.warn(`Session data not found for ${sessionId}`);
            return;
        }

        // Cleanup using specialized services
        try {
            const tempFileManager = (await import('@/services/temp-file-manager')).default;
            const DumpStorage = (await import('@/services/trajectory/dump-storage')).default;

            // Session-level cleanup (files registered during session)
            // Since we moved away from central registry, consumers should handle their own cleanup
            // sessionManager doesn't track specific files anymore

            // Check if there are any active analyses for this trajectory
            const { Analysis } = await import('@/models');
            const hasActiveAnalyses = await Analysis.exists({
                trajectory: trajectoryId,
                finishedAt: { $exists: false }
            });

            if (!hasActiveAnalyses) {
                // Use specialized service for dump cleanup
                await DumpStorage.deleteDumps(trajectoryId);
            } else {
                this.logInfo(`Skipping dump cleanup for trajectory ${trajectoryId} due to active analyses.`);
            }
        } catch (cleanupError) {
            this.logError(`Failed to cleanup for session ${sessionId}: ${cleanupError}`);
        }

        try {
            const session = JSON.parse(sessionData);
            const completedEvent = {
                type: 'session_completed',
                sessionId,
                trajectoryId,
                totalJobs: session.totalJobs,
                startTime: session.startTime,
                completedAt: new Date().toISOString(),
                timestamp: new Date().toISOString()
            };

            await publishJobUpdate(teamId, completedEvent);
            this.logInfo(`Session completed event emitted to team ${teamId} for trajectory ${trajectoryId}`);
        } catch (error) {
            this.logError(`Failed to emit session completed event: ${error}`);
        }
    }

    /**
     * Check and cleanup session after job completion
     */
    async checkAndCleanupSession(job: T): Promise<void> {
        if (!job.sessionId || !job.trajectoryId) return;
        if (this.sessionsBeingCleaned.has(job.sessionId)) return;

        const { sessionId, trajectoryId } = job;

        try {
            const result = await this.executeCleanupScript(sessionId, trajectoryId, job.teamId);
            const [shouldClean] = result;

            if (shouldClean === 1) {
                this.sessionsBeingCleaned.add(sessionId);
                await this.emitSessionCompleted(job.teamId, sessionId, trajectoryId);

                setTimeout(() => {
                    this.sessionsBeingCleaned.delete(sessionId);
                }, 10000);
            }
        } catch (error) {
            this.logError(`Error checking session ${sessionId}: ${error}`);
            this.sessionsBeingCleaned.delete(sessionId);
        }
    }
}
