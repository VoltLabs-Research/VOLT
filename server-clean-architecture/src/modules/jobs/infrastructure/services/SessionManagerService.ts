import { injectable, inject } from 'tsyringe';
import Job from '@modules/jobs/domain/entities/Job';
import JobSession from '@modules/jobs/domain/entities/JobSession';
import { ISessionManagerService, SessionManagerConfig } from '@modules/jobs/domain/ports/ISessionManagerService';
import { IJobRepository } from '@modules/jobs/domain/ports/IJobRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import SessionCompletedEvent from '@modules/jobs/application/events/SessionCompletedEvent';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';

@injectable()
export default class SessionManagerService implements ISessionManagerService {
    private sessionsBeingCleaned = new Set<string>();
    private config!: SessionManagerConfig;

    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) { }

    initialize(config: SessionManagerConfig): void {
        this.config = config;
    }

    generateSessionID(): string {
        return JobSession.generateSessionId();
    }

    async initializeSession(
        sessionId: string,
        sessionStartTime: Date,
        jobCount: number,
        firstJob: Job
    ): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        const counterKey = `session:${sessionId}:remaining`;

        const sessionData = {
            sessionId,
            startTime: sessionStartTime,
            totalJobs: jobCount,
            metadata: firstJob.props.metadata || {},
            teamId: firstJob.props.teamId,
            queueType: firstJob.props.queueType,
            status: 'active'
        };

        const pipeline = this.jobRepository.pipeline();
        pipeline.setex(sessionKey, this.config.sessionTTLSeconds, JSON.stringify(sessionData));
        pipeline.set(counterKey, jobCount.toString());
        pipeline.expire(counterKey, this.config.sessionTTLSeconds);
        await pipeline.exec();
    }

    async executeCleanupScript(sessionId: string): Promise<[number, number, string, string | null]> {
        const luaScript = `
            local sessionId = ARGV[1]
            local sessionKey = "session:" .. sessionId
            local counterKey = sessionKey .. ":remaining"

            local remaining = redis.call('DECR', counterKey)

            if remaining <= 0 then
                local sessionData = redis.call('GET', sessionKey)
                redis.call('DEL', sessionKey)
                redis.call('DEL', counterKey)
                return {1, 0, "cleaned", sessionData}
            else
                return {0, remaining, "pending", nil}
            end
        `;

        return await this.jobRepository.evalScript(
            luaScript,
            0,
            sessionId
        ) as [number, number, string, string | null];
    }

    async emitSessionCompleted(
        teamId: string,
        sessionId: string,
        sessionDataRaw: string
    ): Promise<void> {
        if (!sessionDataRaw) {
            console.warn(`Session data not found for ${sessionId}`);
            return;
        }

        const sessionData = JSON.parse(sessionDataRaw);
        const event = new SessionCompletedEvent({
            sessionId,
            teamId,
            queueType: sessionData.queueType,
            totalJobs: sessionData.totalJobs,
            startTime: new Date(sessionData.startTime),
            completedAt: new Date(),
            metadata: sessionData.metadata
        });

        console.log(`[SessionManagerService] Emitting session.completed event: sessionId=${sessionId}, queueType=${sessionData.queueType}, trajectoryId=${sessionData.metadata?.trajectoryId}`);
        await this.eventBus.publish(event);
    }

    async checkAndCleanupSession(job: Job): Promise<void> {
        if (!job.props.sessionId) return;
        if (this.sessionsBeingCleaned.has(job.props.sessionId)) return;

        const { sessionId } = job.props;

        try {
            const result = await this.executeCleanupScript(sessionId);
            const [shouldClean, , , sessionData] = result;

            if (shouldClean === 1 && sessionData) {
                this.sessionsBeingCleaned.add(sessionId);
                await this.emitSessionCompleted(job.props.teamId, sessionId, sessionData);

                setTimeout(() => {
                    this.sessionsBeingCleaned.delete(sessionId);
                }, 10000);
            }
        } catch (error) {
            this.sessionsBeingCleaned.delete(sessionId);
        }
    }
};