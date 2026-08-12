import { getKeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';
import { randomUUID } from 'node:crypto';

export interface ScriptingSessionLockLease {
    release(): Promise<void>;
}

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
