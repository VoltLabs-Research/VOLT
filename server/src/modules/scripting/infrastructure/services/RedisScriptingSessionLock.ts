import { randomUUID } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import type IORedis from 'ioredis';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type {
    IScriptingSessionLock,
    IScriptingSessionLockLease
} from '@modules/scripting/application/port/IScriptingSessionLock';

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
end
return 0
`;

@injectable()
export class RedisScriptingSessionLock implements IScriptingSessionLock {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    async acquire(key: string, ttlMs: number): Promise<IScriptingSessionLockLease | null> {
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
