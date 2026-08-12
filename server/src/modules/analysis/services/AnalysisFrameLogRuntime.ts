import type {
    AnalysisFrameLogIdentity,
    StoredAnalysisFrameLogRecord
} from '@modules/analysis/contracts/analysis-execution-log';
import {
    readStoredFrameLog,
    writeStoredFrameLog
} from '@modules/analysis/services/AnalysisFrameLogStore';

const PERSIST_DEBOUNCE_MS = 500;

export interface FrameLogRuntimeState {
    storageClusterId: string;
    record: StoredAnalysisFrameLogRecord | null;
    persistTimer: ReturnType<typeof setTimeout> | null;
    persisting: Promise<void>;
}

const frameKeyOf = (analysisId: string, timestep: number): string => {
    return `${analysisId}:${timestep}`;
};

class AnalysisFrameLogRuntime {
    private readonly mutationChains = new Map<string, Promise<void>>();
    private readonly states = new Map<string, FrameLogRuntimeState>();

    async serialize<TResult>(
        analysisId: string,
        timestep: number,
        operation: () => Promise<TResult>
    ): Promise<TResult> {
        const frameKey = frameKeyOf(analysisId, timestep);
        const previous = this.mutationChains.get(frameKey) ?? Promise.resolve();
        let releaseCurrent!: () => void;
        const current = new Promise<void>((resolve) => {
            releaseCurrent = resolve;
        });
        const tail = previous
            .catch(() => undefined)
            .then(() => current);

        this.mutationChains.set(frameKey, tail);

        try {
            await previous.catch(() => undefined);
            return await operation();
        } finally {
            releaseCurrent();
            if (this.mutationChains.get(frameKey) === tail) {
                this.mutationChains.delete(frameKey);
            }
        }
    }

    async waitForPendingMutations(analysisId: string, timestep: number): Promise<void> {
        const pending = this.mutationChains.get(frameKeyOf(analysisId, timestep));
        if (!pending) {
            return;
        }

        await pending.catch(() => undefined);
    }

    getCachedState(analysisId: string, timestep: number): FrameLogRuntimeState | undefined {
        return this.states.get(frameKeyOf(analysisId, timestep));
    }

    async loadState(
        storageClusterId: string,
        identity: AnalysisFrameLogIdentity
    ): Promise<FrameLogRuntimeState> {
        const frameKey = frameKeyOf(identity.analysisId, identity.timestep);
        const existing = this.states.get(frameKey);
        if (existing) {
            return existing;
        }

        const state: FrameLogRuntimeState = {
            storageClusterId,
            record: await readStoredFrameLog(storageClusterId, identity),
            persistTimer: null,
            persisting: Promise.resolve()
        };
        this.states.set(frameKey, state);
        return state;
    }

    schedulePersist(state: FrameLogRuntimeState): void {
        if (state.persistTimer) {
            clearTimeout(state.persistTimer);
        }

        state.persistTimer = setTimeout(() => {
            state.persistTimer = null;
            void this.flush(state).catch(() => undefined);
        }, PERSIST_DEBOUNCE_MS);
    }

    async flush(state: FrameLogRuntimeState): Promise<void> {
        if (state.persistTimer) {
            clearTimeout(state.persistTimer);
            state.persistTimer = null;
        }

        state.persisting = state.persisting
            .catch(() => undefined)
            .then(() => {
                const record = state.record;
                return record ? writeStoredFrameLog(state.storageClusterId, record) : undefined;
            });

        await state.persisting;
    }

    discard(analysisId: string, timestep: number): void {
        this.states.delete(frameKeyOf(analysisId, timestep));
    }

    async drainAnalysis(analysisId: string): Promise<void> {
        const analysisPrefix = `${analysisId}:`;

        await Promise.all(
            [...this.mutationChains.entries()]
                .filter(([frameKey]) => frameKey.startsWith(analysisPrefix))
                .map(([, mutation]) => mutation.catch(() => undefined))
        );

        for (const [frameKey, state] of this.states) {
            if (!frameKey.startsWith(analysisPrefix)) {
                continue;
            }

            if (state.persistTimer) {
                clearTimeout(state.persistTimer);
                state.persistTimer = null;
            }

            await state.persisting.catch(() => undefined);
            this.states.delete(frameKey);
        }
    }
}

export default new AnalysisFrameLogRuntime();
