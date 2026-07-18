import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type IORedis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { container as diContainer } from 'tsyringe';

export interface ScriptingSessionLockLease {
    release(): Promise<void>;
}

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
end
return 0
`;

export class RedisScriptingSessionLock {
    #redisCache?: IORedis;
    private get redis(): IORedis {
        return (this.#redisCache ??= diContainer.resolve<IORedis>(SHARED_TOKENS.RedisClient));
    }

    async acquire(key: string, ttlMs: number): Promise<ScriptingSessionLockLease | null> {
        const token = randomUUID();
        const acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX');

        if (!acquired) {
            return null;
        }

        return {
            release: async () => {
                await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
            }
        };
    }
}

export default new RedisScriptingSessionLock();
