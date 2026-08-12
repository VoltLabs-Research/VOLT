import { getKeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';
import type { JobStatus } from '@volt/contracts/modules/jobs/domain';

const SESSION_TTL_MS = 86_400_000;

export interface DaemonSessionKeys {
    remaining: string;
    failed: string;
    terminalSet: string;
    terminal: (jobId: string) => string;
}

export interface DaemonSessionInitialization {
    remainingJobs: number;
    failedJobs: number;
}

export interface DaemonSessionDrainResult {
    drained: boolean;
    failedJobs: number;
}

const sessionKeys = (namespace: string, id: string): DaemonSessionKeys => {
    const base = `${namespace}:${id}`;
    return {
        remaining: `${base}:remaining`,
        failed: `${base}:failed`,
        terminalSet: `${base}:terminal-keys`,
        terminal: (jobId: string) => `${base}:terminal:${jobId}`
    };
};

class DaemonAnalysisSessionStore {
    analysisKeys(analysisId: string): DaemonSessionKeys {
        return sessionKeys('daemon-analysis', analysisId);
    }

    glbKeys(trajectoryId: string): DaemonSessionKeys {
        return sessionKeys('daemon-glb', trajectoryId);
    }

    async initialize(keys: DaemonSessionKeys, totalJobs: number): Promise<DaemonSessionInitialization> {
        return getKeyValueStore().withLock(keys.remaining, async (store) => {
            const terminalCount = await store.setCount(keys.terminalSet);
            const failedJobs = Number(await store.get(keys.failed) ?? 0);
            const remainingJobs = Math.max(0, totalJobs - terminalCount);

            if (remainingJobs > 0) {
                await store.set(keys.remaining, String(remainingJobs), { ttlMs: SESSION_TTL_MS });
            } else {
                await store.delete([keys.remaining]);
            }

            await store.expire(keys.failed, SESSION_TTL_MS);
            await store.setExpire(keys.terminalSet, SESSION_TTL_MS);

            return {
                remainingJobs,
                failedJobs
            };
        });
    }

    async tryMarkTerminalReceipt(keys: DaemonSessionKeys, jobId: string, status: JobStatus): Promise<boolean> {
        const receiptKey = keys.terminal(jobId);
        const store = getKeyValueStore();

        const claimed = await store.set(receiptKey, status, {
            ttlMs: SESSION_TTL_MS,
            ifNotExists: true
        });

        if (!claimed) {
            return false;
        }

        await store.setAdd(keys.terminalSet, [receiptKey], { ttlMs: SESSION_TTL_MS });
        return true;
    }

    hasTerminalReceipt(keys: DaemonSessionKeys, jobId: string): Promise<boolean> {
        return getKeyValueStore().exists(keys.terminal(jobId));
    }

    async recordFailure(keys: DaemonSessionKeys): Promise<void> {
        await getKeyValueStore().adjust(keys.failed, 1, { ttlMs: SESSION_TTL_MS });
    }

    async decrementAndCheckDrain(keys: DaemonSessionKeys): Promise<DaemonSessionDrainResult> {
        return getKeyValueStore().withLock(keys.remaining, async (store) => {
            if (!await store.exists(keys.remaining)) {
                return {
                    drained: false,
                    failedJobs: 0
                };
            }

            const remaining = await store.adjust(keys.remaining, -1, { ttlMs: SESSION_TTL_MS });
            if (remaining > 0) {
                return {
                    drained: false,
                    failedJobs: 0
                };
            }

            const failedJobs = Number(await store.get(keys.failed) ?? 0);
            await store.delete([keys.remaining, keys.failed]);

            return {
                drained: true,
                failedJobs
            };
        });
    }
}

export default new DaemonAnalysisSessionStore();
