import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import IORedis from 'ioredis';

export enum ChatPresenceStatus {
    Online = 'online',
    Offline = 'offline'
};

const PRESENCE_TTL_SECONDS = 120;
const PRESENCE_REFRESH_INTERVAL_MS = 60_000;
const USER_PRESENCE_KEY_PREFIX = 'chat:presence:user:';
const SOCKET_PRESENCE_KEY_PREFIX = 'chat:presence:socket:';

@injectable()
export default class ChatSocketPresenceService {
    private readonly presenceIntervals = new Map<string, NodeJS.Timeout>();

    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    async connect(userId: string, socketId: string): Promise<void> {
        this.stopPresenceRefresh(socketId);
        await this.registerPresence(userId, socketId);
        this.startPresenceRefresh(userId, socketId);
    }

    async disconnect(userId: string, socketId: string): Promise<void> {
        this.stopPresenceRefresh(socketId);
        await this.unregisterPresence(userId, socketId);
    }

    async getUsersPresence(userIds: string[]): Promise<Record<string, ChatPresenceStatus>> {
        const presence: Record<string, ChatPresenceStatus> = {};

        if (userIds.length === 0) {
            return presence;
        }

        const userSocketsPipeline = this.redis.pipeline();
        for (const userId of userIds) {
            userSocketsPipeline.smembers(this.getUserPresenceKey(userId));
        }

        const userSocketsResults = await userSocketsPipeline.exec();
        const activeSocketKeys: string[] = [];
        const socketIdsByUserId = new Map<string, string[]>();

        for (let index = 0; index < userIds.length; index++) {
            const redisResult = userSocketsResults?.[index]?.[1];
            let socketIds: string[] = [];

            if (Array.isArray(redisResult)) {
                socketIds = redisResult.filter((value): value is string => typeof value === 'string');
            }

            socketIdsByUserId.set(userIds[index], socketIds);

            for (const socketId of socketIds) {
                activeSocketKeys.push(this.getSocketPresenceKey(socketId));
            }
        }

        const activeSockets = await this.resolveActiveSockets(activeSocketKeys);

        for (const userId of userIds) {
            const socketIds = socketIdsByUserId.get(userId) || [];
            const onlineSocketIds = socketIds.filter((socketId) => activeSockets.has(socketId));
            const staleSocketIds = socketIds.filter((socketId) => !activeSockets.has(socketId));

            if (staleSocketIds.length > 0) {
                await this.redis.srem(this.getUserPresenceKey(userId), ...staleSocketIds);
            }

            let status = ChatPresenceStatus.Offline;
            if (onlineSocketIds.length > 0) {
                status = ChatPresenceStatus.Online;
            }

            presence[userId] = status;
        }

        return presence;
    }

    async shutdown(): Promise<void> {
        for (const interval of this.presenceIntervals.values()) {
            clearInterval(interval);
        }

        this.presenceIntervals.clear();
    }

    private getUserPresenceKey(userId: string): string {
        return `${USER_PRESENCE_KEY_PREFIX}${userId}:sockets`;
    }

    private getSocketPresenceKey(socketId: string): string {
        return `${SOCKET_PRESENCE_KEY_PREFIX}${socketId}`;
    }

    private async registerPresence(userId: string, socketId: string): Promise<void> {
        const userPresenceKey = this.getUserPresenceKey(userId);
        const socketPresenceKey = this.getSocketPresenceKey(socketId);

        await this.redis.multi()
            .sadd(userPresenceKey, socketId)
            .expire(userPresenceKey, PRESENCE_TTL_SECONDS * 2)
            .set(socketPresenceKey, userId, 'EX', PRESENCE_TTL_SECONDS)
            .exec();
    }

    private async unregisterPresence(userId: string, socketId: string): Promise<void> {
        const userPresenceKey = this.getUserPresenceKey(userId);
        const socketPresenceKey = this.getSocketPresenceKey(socketId);

        await this.redis.multi()
            .del(socketPresenceKey)
            .srem(userPresenceKey, socketId)
            .exec();
    }

    private startPresenceRefresh(userId: string, socketId: string): void {
        const interval = setInterval(() => {
            this.refreshPresence(userId, socketId);
        }, PRESENCE_REFRESH_INTERVAL_MS);

        this.presenceIntervals.set(socketId, interval);
    }

    private async refreshPresence(userId: string, socketId: string): Promise<void> {
        try {
            await this.registerPresence(userId, socketId);
        } catch (error) {
            logger.error(`@chat-socket - presence refresh error: ${error}`);
        }
    }

    private stopPresenceRefresh(socketId: string): void {
        const interval = this.presenceIntervals.get(socketId);

        if (!interval) {
            return;
        }

        clearInterval(interval);
        this.presenceIntervals.delete(socketId);
    }

    private async resolveActiveSockets(activeSocketKeys: string[]): Promise<Set<string>> {
        if (activeSocketKeys.length === 0) {
            return new Set<string>();
        }

        const socketStatusPipeline = this.redis.pipeline();
        for (const socketKey of activeSocketKeys) {
            socketStatusPipeline.exists(socketKey);
        }

        const socketStatusResults = await socketStatusPipeline.exec();
        const activeSockets = new Set<string>();

        for (let index = 0; index < activeSocketKeys.length; index++) {
            if (socketStatusResults?.[index]?.[1] === 1) {
                activeSockets.add(activeSocketKeys[index].replace(SOCKET_PRESENCE_KEY_PREFIX, ''));
            }
        }

        return activeSockets;
    }
};
