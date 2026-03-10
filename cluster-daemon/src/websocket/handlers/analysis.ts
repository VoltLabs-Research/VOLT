import { startAnalysis } from '../../core/runtimeActions';
import type { QueueService } from '../../infrastructure/redis/QueueService';
import type { RedisConnectionService } from '../../infrastructure/redis/RedisConnectionService';
import type { RuntimeEventBroker } from '../../infrastructure/RuntimeEventBroker';
import type { ReverseChannelCommandHandler } from '../ReverseChannelSocketBridge';

interface AnalysisHandlersDependencies {
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    eventBroker: RuntimeEventBroker;
}

export const createAnalysisHandlers = (deps: AnalysisHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'analysis.start',
        execute: async (payload) => {
            await startAnalysis(payload as never, deps.queueService, deps.redisConnectionService, deps.eventBroker);
            return { data: { queued: true } };
        }
    }
];
