import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ModuleRegistry } from './ModuleRegistry';
import { defineModule } from './defineModule';

/** The kernel keys used across these tests (tier: 'kernel'). */
const KERNEL_KEYS = ['auth', 'session', 'socket', 'team'] as const;

/**
 * Build a registry pre-loaded with the four kernel modules plus whatever extra
 * manifests a test supplies. Kernel modules are declared as `kernel` tier with
 * no deps so they are valid on their own.
 */
const makeRegistry = (...extra: Parameters<ModuleRegistry['register']>[0][]): ModuleRegistry => {
    const registry = new ModuleRegistry();
    for (const key of KERNEL_KEYS) {
        registry.register(defineModule({ key, tier: 'kernel' }));
    }
    for (const manifest of extra) registry.register(manifest);
    return registry;
};

test('register: throws on duplicate key', () => {
    const registry = new ModuleRegistry();
    registry.register(defineModule({ key: 'latex', tier: 'leaf' }));
    assert.throws(() => registry.register(defineModule({ key: 'latex', tier: 'leaf' })), /already registered/);
});

test('kernelKeys: derived from tier', () => {
    const registry = makeRegistry(
        defineModule({ key: 'system', tier: 'kernel' }),
        defineModule({ key: 'latex', tier: 'leaf' })
    );
    assert.deepEqual(registry.kernelKeys().sort(), ['auth', 'session', 'socket', 'system', 'team']);
});

test('resolveEnabled: no overrides returns all registered + kernel', () => {
    const registry = makeRegistry(
        defineModule({ key: 'cluster', tier: 'compute' }),
        defineModule({ key: 'latex', tier: 'leaf' })
    );
    const enabled = registry.resolveEnabled({});
    // All six registered keys present.
    for (const key of [...KERNEL_KEYS, 'cluster', 'latex']) {
        assert.ok(enabled.has(key), `expected "${key}" to be enabled`);
    }
    assert.equal(enabled.size, 6);
});

test('resolveEnabled: envOverride seeds the set (kernel still forced)', () => {
    const registry = makeRegistry(
        defineModule({ key: 'cluster', tier: 'compute' }),
        defineModule({ key: 'latex', tier: 'leaf' })
    );
    const enabled = registry.resolveEnabled({ envOverride: ['latex'] });
    assert.ok(enabled.has('latex'), 'envOverride entry should be enabled');
    assert.ok(!enabled.has('cluster'), 'an unselected non-kernel module should be excluded');
});

test('resolveEnabled: enabling a leaf auto-includes its hard deps transitively', () => {
    const registry = makeRegistry(
        defineModule({ key: 'cluster', tier: 'compute', requires: ['container'] }),
        defineModule({ key: 'container', tier: 'capability' }),
        defineModule({ key: 'latex', tier: 'leaf', requires: ['cluster'] })
    );
    const enabled = registry.resolveEnabled({ envOverride: ['latex'] });
    assert.ok(enabled.has('latex'));
    assert.ok(enabled.has('cluster'), 'direct hard dep should be auto-included');
    assert.ok(enabled.has('container'), 'transitive hard dep should be auto-included');
});

test('resolveEnabled: kernel always present even if envOverride omits it', () => {
    const registry = makeRegistry(defineModule({ key: 'latex', tier: 'leaf' }));
    const enabled = registry.resolveEnabled({ envOverride: ['latex'] });
    for (const key of KERNEL_KEYS) {
        assert.ok(enabled.has(key), `kernel module "${key}" must be force-included`);
    }
});

test('validate: clean set passes', () => {
    const registry = makeRegistry(
        defineModule({ key: 'cluster', tier: 'compute' }),
        defineModule({ key: 'latex', tier: 'leaf', requires: ['cluster'] })
    );
    const result = registry.validate(registry.resolveEnabled({}));
    assert.equal(result.ok, true, result.errors.join('; '));
    assert.deepEqual(result.errors, []);
});

test('validate: flags a module requiring an unknown key', () => {
    const registry = makeRegistry(
        defineModule({ key: 'latex', tier: 'leaf', requires: ['ghost'] })
    );
    const enabled = registry.resolveEnabled({});
    const result = registry.validate(enabled);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /unknown module "ghost"/.test(e)), result.errors.join('; '));
});

test('validate: flags a requires-cycle', () => {
    const registry = makeRegistry(
        defineModule({ key: 'a', tier: 'leaf', requires: ['b'] }),
        defineModule({ key: 'b', tier: 'leaf', requires: ['a'] })
    );
    const enabled = registry.resolveEnabled({ envOverride: ['a', 'b'] });
    const result = registry.validate(enabled);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /Requires-cycle detected/.test(e)), result.errors.join('; '));
});

test('validate: flags an excluded kernel module', () => {
    const registry = makeRegistry();
    const enabled = new Set<string>(['session', 'socket', 'team']); // 'auth' missing
    const result = registry.validate(enabled);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /Kernel module "auth"/.test(e)), result.errors.join('; '));
});

test('isEnabled: reflects set membership', () => {
    const registry = makeRegistry(defineModule({ key: 'latex', tier: 'leaf' }));
    const enabled = registry.resolveEnabled({ envOverride: ['latex'] });
    assert.equal(registry.isEnabled('latex', enabled), true);
    assert.equal(registry.isEnabled('cluster', enabled), false);
});
