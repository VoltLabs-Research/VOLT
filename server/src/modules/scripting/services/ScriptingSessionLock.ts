import { getKeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';
import { randomUUID } from 'node:crypto';

export interface ScriptingSessionLockLease {
    release(): Promise<void>;
}

/**
 * A lease over a scripting session, held for at most `ttlMs`.
 *
 * The lease carries a token and release is a compare-and-delete, so a holder
 * that overran its deadline cannot free a lock another caller has since taken.
 * The deadline is the only thing that recovers a crashed holder.
 */
class ScriptingSessionLock {
    async acquire(key: string, ttlMs: number): Promise<ScriptingSessionLockLease | null> {
        const token = randomUUID();
        const store = getKeyValueStore();

        const acquired = await store.set(key, token, {
            ttlMs,
            ifNotExists: true
        });

        if (!acquired) {
            return null;
        }

        return {
            release: async () => {
                await store.deleteIfValue(key, token);
            }
        };
    }
}

export default new ScriptingSessionLock();
