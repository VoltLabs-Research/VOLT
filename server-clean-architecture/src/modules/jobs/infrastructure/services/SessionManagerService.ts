import { injectable, inject } from "tsyringe";
import Job from "../../domain/entities/Job";
import JobSession from "../../domain/entities/JobSession";
import { ISessionManagerService, SessionManagerConfig } from "../../domain/ports/ISessionManagerService";
import { IJobRepository } from "../../domain/ports/IJobRepository";
import { SHARED_TOKENS } from "../../../../shared/infrastructure/di/SharedTokens";
import { IEventBus } from "../../../../shared/application/events/IEventBus";
import SessionCompletedEvent from "../../application/events/SessionCompletedEvent";
import { JOBS_TOKENS } from "../di/JobsTokens";

@injectable()
export default class SessionManagerService implements ISessionManagerService{
    private sessionsBeingCleaned = new Set<string>();
    private config!: SessionManagerConfig;

    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    initialize(config: SessionManagerConfig): void{
        this.config = config;
    }

    generateSessionID(): string{
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
            status: 'active'
        };

        const pipeline = this.jobRepository.pipeline();
        pipeline.setex(sessionKey, this.config.sessionTTLSeconds, JSON.stringify(sessionData));
        pipeline.set(counterKey, jobCount.toString());
        pipeline.expire(counterKey, this.config.sessionTTLSeconds);
        await pipeline.exec();
    }

    async executeCleanupScript(sessionId: string): Promise<[number, number, string]> {
        const luaScript = `
            local sessionId = ARGV[1]
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

       return await this.jobRepository.evalScript(
            luaScript,
            0,
            sessionId
        ) as [number, number, string];
    }

     async emitSessionCompleted(
        teamId: string,
        sessionId: string
    ): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        const sessionDataRaw = await this.jobRepository.get(sessionKey);

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

        await this.eventBus.publish(event);
    }

    async checkAndCleanupSession(job: Job): Promise<void> {
        if (!job.props.sessionId) return;
        if (this.sessionsBeingCleaned.has(job.props.sessionId)) return;

        const { sessionId } = job.props;

        try {
            const result = await this.executeCleanupScript(sessionId);
            const [shouldClean] = result;

            if (shouldClean === 1) {
                this.sessionsBeingCleaned.add(sessionId);
                await this.emitSessionCompleted(job.props.teamId, sessionId);

                setTimeout(() => {
                    this.sessionsBeingCleaned.delete(sessionId);
                }, 10000);
            }
        } catch (error) {
            this.sessionsBeingCleaned.delete(sessionId);
        }
    }
};