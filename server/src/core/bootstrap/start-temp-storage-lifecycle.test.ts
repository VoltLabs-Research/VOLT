import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { startTempStorageLifecycle } from '@core/bootstrap/start-temp-storage-lifecycle';
import type { ITempStorageLifecycleService } from '@shared/domain/port/ITempStorageLifecycleService';

class StubTempStorageLifecycleService implements ITempStorageLifecycleService {
    public started = false;

    async start(): Promise<void> {
        this.started = true;
    }

    stop(): void {}

    async runCleanupCycle(): Promise<void> {}
};

class RejectingTempStorageLifecycleService implements ITempStorageLifecycleService {
    async start(): Promise<void> {
        throw new Error('startup cleanup failed');
    }

    stop(): void {}

    async runCleanupCycle(): Promise<void> {}
};

test('startTempStorageLifecycle starts the lifecycle service', async () => {
    const service = new StubTempStorageLifecycleService();

    await startTempStorageLifecycle(service);

    assert.equal(service.started, true);
});

test('startTempStorageLifecycle treats startup cleanup failures as non-fatal', async () => {
    const service = new RejectingTempStorageLifecycleService();

    await assert.doesNotReject(startTempStorageLifecycle(service));
});
