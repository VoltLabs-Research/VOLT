import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import {
    DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB,
    PLUGIN_PROCESS_MEMORY_BUDGET_RATIO,
    getTotalSystemMemoryMb,
    deriveDefaultPluginProcessMemoryBudgetMb,
    resolvePluginProcessMemoryBudgetMb,
    resolvePluginProcessEstMemoryMb,
    computePluginProcessMemorySlots,
    computeEffectivePluginProcessConcurrency,
    selectAvailableMemoryMb
} from './runtime-capacity';

const BYTES_PER_MB = 1024 * 1024;

const MEMORY_ENV_KEYS = ['PLUGIN_PROCESS_POOL_MAX_MEMORY_MB', 'PLUGIN_PROCESS_EST_MEMORY_MB'] as const;

/**
 * Runs `body` with the provided env overrides applied, then fully restores the
 * previous environment (including unsetting keys that were originally absent).
 */
const withEnv = (overrides: Record<string, string | undefined>, body: () => void): void => {
    const keys = Object.keys(overrides);
    const previous: Record<string, string | undefined> = {};
    for (const key of keys) {
        previous[key] = process.env[key];
        if (overrides[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = overrides[key];
        }
    }
    try {
        body();
    } finally {
        for (const key of keys) {
            const value = previous[key];
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
};

const clearMemoryEnv = (body: () => void): void => {
    withEnv(Object.fromEntries(MEMORY_ENV_KEYS.map((key) => [key, undefined])), body);
};

test('computePluginProcessMemorySlots floors the budget division', () => {
    assert.equal(computePluginProcessMemorySlots(4096, 1024), 4);
    assert.equal(computePluginProcessMemorySlots(4500, 1024), 4); // floor(4.39)
    assert.equal(computePluginProcessMemorySlots(2048, 1024), 2);
    assert.equal(computePluginProcessMemorySlots(1024, 1024), 1);
});

test('computePluginProcessMemorySlots never drops below 1', () => {
    assert.equal(computePluginProcessMemorySlots(512, 1024), 1); // floor(0.5) clamped
    assert.equal(computePluginProcessMemorySlots(0, 1024), 1);
    assert.equal(computePluginProcessMemorySlots(1024, 0), 1); // guard against divide-by-zero
    assert.equal(computePluginProcessMemorySlots(1024, -5), 1);
});

test('computeEffectivePluginProcessConcurrency selects the smaller ceiling', () => {
    assert.equal(computeEffectivePluginProcessConcurrency(7, 11), 7); // CPU bound
    assert.equal(computeEffectivePluginProcessConcurrency(7, 1), 1); // memory bound
    assert.equal(computeEffectivePluginProcessConcurrency(4, 4), 4);
});

test('computeEffectivePluginProcessConcurrency never drops below 1', () => {
    assert.equal(computeEffectivePluginProcessConcurrency(0, 5), 1);
    assert.equal(computeEffectivePluginProcessConcurrency(5, 0), 1);
    assert.equal(computeEffectivePluginProcessConcurrency(0, 0), 1);
});

test('default budget ratio and per-process estimate match the spec', () => {
    assert.equal(PLUGIN_PROCESS_MEMORY_BUDGET_RATIO, 0.7);
    assert.equal(DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB, 1024);
});

test('deriveDefaultPluginProcessMemoryBudgetMb takes ~70% of total RAM', () => {
    // Compare against the same formula to stay robust against float rounding.
    assert.equal(
        deriveDefaultPluginProcessMemoryBudgetMb(10000),
        Math.max(1, Math.floor(10000 * PLUGIN_PROCESS_MEMORY_BUDGET_RATIO))
    );
    assert.equal(
        deriveDefaultPluginProcessMemoryBudgetMb(16384),
        Math.max(1, Math.floor(16384 * PLUGIN_PROCESS_MEMORY_BUDGET_RATIO))
    );
    // Sanity: a 16 GB box yields a budget in the expected neighbourhood.
    assert.ok(deriveDefaultPluginProcessMemoryBudgetMb(16384) >= 11000);
    assert.ok(deriveDefaultPluginProcessMemoryBudgetMb(16384) <= 16384);
});

test('deriveDefaultPluginProcessMemoryBudgetMb never drops below 1', () => {
    assert.equal(deriveDefaultPluginProcessMemoryBudgetMb(1), 1);
    assert.equal(deriveDefaultPluginProcessMemoryBudgetMb(0), 1);
});

test('getTotalSystemMemoryMb reflects os.totalmem in MB and stays >= 1', () => {
    assert.equal(getTotalSystemMemoryMb(), Math.max(1, Math.floor(os.totalmem() / BYTES_PER_MB)));
    assert.ok(getTotalSystemMemoryMb() >= 1);
});

test('resolvePluginProcessEstMemoryMb defaults to 1024 when env unset', () => {
    clearMemoryEnv(() => {
        assert.equal(resolvePluginProcessEstMemoryMb(), DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB);
        assert.equal(resolvePluginProcessEstMemoryMb(), 1024);
    });
});

test('resolvePluginProcessEstMemoryMb honors a valid env override', () => {
    withEnv({ PLUGIN_PROCESS_EST_MEMORY_MB: '512' }, () => {
        assert.equal(resolvePluginProcessEstMemoryMb(), 512);
    });
});

test('resolvePluginProcessEstMemoryMb ignores invalid env values', () => {
    withEnv({ PLUGIN_PROCESS_EST_MEMORY_MB: '0' }, () => {
        assert.equal(resolvePluginProcessEstMemoryMb(), DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB);
    });
    withEnv({ PLUGIN_PROCESS_EST_MEMORY_MB: 'abc' }, () => {
        assert.equal(resolvePluginProcessEstMemoryMb(), DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB);
    });
});

test('resolvePluginProcessMemoryBudgetMb derives from total RAM when env unset', () => {
    clearMemoryEnv(() => {
        const expected = deriveDefaultPluginProcessMemoryBudgetMb(getTotalSystemMemoryMb());
        assert.equal(resolvePluginProcessMemoryBudgetMb(), expected);
        assert.ok(resolvePluginProcessMemoryBudgetMb() >= 1);
    });
});

test('resolvePluginProcessMemoryBudgetMb honors a valid env override', () => {
    withEnv({ PLUGIN_PROCESS_POOL_MAX_MEMORY_MB: '2048' }, () => {
        assert.equal(resolvePluginProcessMemoryBudgetMb(), 2048);
    });
});

test('selectAvailableMemoryMb prefers available over free', () => {
    assert.equal(selectAvailableMemoryMb({ available: 2 * BYTES_PER_MB, free: 1 * BYTES_PER_MB }), 2);
});

test('selectAvailableMemoryMb falls back to free when available is missing or non-positive', () => {
    assert.equal(selectAvailableMemoryMb({ free: 3 * BYTES_PER_MB }), 3);
    assert.equal(selectAvailableMemoryMb({ available: 0, free: 5 * BYTES_PER_MB }), 5);
    assert.equal(selectAvailableMemoryMb({ available: -1, free: 5 * BYTES_PER_MB }), 5);
});

test('selectAvailableMemoryMb returns 0 when no usable reading is present', () => {
    assert.equal(selectAvailableMemoryMb({}), 0);
    assert.equal(selectAvailableMemoryMb({ available: 0, free: 0 }), 0);
});

test('end-to-end default admission ceiling stays >= 1 and respects min(cpu, mem)', () => {
    clearMemoryEnv(() => {
        const estMb = resolvePluginProcessEstMemoryMb();
        const budgetMb = resolvePluginProcessMemoryBudgetMb();
        const memorySlots = computePluginProcessMemorySlots(budgetMb, estMb);
        const cpuCeiling = 8;
        const effective = computeEffectivePluginProcessConcurrency(cpuCeiling, memorySlots);

        assert.ok(memorySlots >= 1);
        assert.ok(effective >= 1);
        assert.equal(effective, Math.max(1, Math.min(cpuCeiling, memorySlots)));
    });
});
