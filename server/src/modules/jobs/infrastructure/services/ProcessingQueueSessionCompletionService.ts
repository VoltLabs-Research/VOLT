import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import ProcessingQueueEventPublisher from '@modules/jobs/infrastructure/services/ProcessingQueueEventPublisher';
import ProcessingQueueSessionStore from '@modules/jobs/infrastructure/services/ProcessingQueueSessionStore';
import logger from '@shared/infrastructure/logger';
import type { QueueJobData } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';

const CLEANUP_GUARD_RELEASE_MS = 10000;

export default class ProcessingQueueSessionCompletionService {
    private readonly sessionsBeingCleaned = new Set<string>();

    constructor(
        private readonly queueName: string,
        private readonly sessionStore: ProcessingQueueSessionStore,
        private readonly eventPublisher: ProcessingQueueEventPublisher
    ) {}

    async handleJobSettlement(jobData: QueueJobData): Promise<void> {
        const sessionId = typeof jobData.sessionId === 'string' ? jobData.sessionId : undefined;
        if (!sessionId || this.sessionsBeingCleaned.has(sessionId)) {
            return;
        }

        const drainResult = await this.sessionStore.completeSessionIfDrained(sessionId);
        if (!drainResult.completed) {
            return;
        }

        if (!drainResult.sessionData || drainResult.missingSessionData) {
            logger.error(
                `[${this.queueName}] Session ${sessionId} counter reached zero but session data is missing. Check SESSION_TTL_SECONDS.`
            );
            return;
        }

        this.sessionsBeingCleaned.add(sessionId);

        try {
            const sessionData = drainResult.sessionData;
            let teamId = String(sessionData.teamId);
            if (typeof jobData.teamId === 'string') {
                teamId = jobData.teamId;
            }

            let metadata: Record<string, unknown> | undefined;
            if (isRecord(sessionData.metadata)) {
                metadata = sessionData.metadata;
            }

            await this.eventPublisher.publishSessionCompleted({
                sessionId,
                teamId,
                queueType: String(sessionData.queueType),
                totalJobs: Number(sessionData.totalJobs || 0),
                startTime: new Date(String(sessionData.startTime)),
                completedAt: new Date(),
                metadata,
                failureSummary: drainResult.failureSummary
            });
        } finally {
            setTimeout(() => {
                this.sessionsBeingCleaned.delete(sessionId);
            }, CLEANUP_GUARD_RELEASE_MS);
        }
    }
};
