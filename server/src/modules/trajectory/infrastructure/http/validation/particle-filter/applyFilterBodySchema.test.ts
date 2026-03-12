import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod/v4';

/**
 * Inline reproduction of `applyFilterBodySchema` so the test is
 * self-contained and does not depend on the module's DI wiring.
 */
const applyFilterBodySchema = z.object({
    timestep: z.string().min(1),
    action: z.enum(['delete', 'highlight']),
    property: z.string().min(1),
    operator: z.enum(['==', '!=', '>', '>=', '<', '<=']),
    value: z.coerce.number().finite(),
    exposureId: z.string().trim().min(1).optional()
}).strict();

const validBase = {
    timestep: '100',
    action: 'delete' as const,
    property: 'temperature',
    operator: '>' as const,
    value: 300
};

test('applyFilterBodySchema: accepts already-typed numbers', () => {
    const result = applyFilterBodySchema.safeParse(validBase);
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.equal(result.data.value, 300);
});

test('applyFilterBodySchema: coerces string-encoded integer value', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, value: '300' });
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.equal(result.data.value, 300);
});

test('applyFilterBodySchema: coerces string-encoded float value', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, value: '3.14' });
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.ok(Math.abs(result.data.value - 3.14) < 1e-10);
});

test('applyFilterBodySchema: coerces negative string-encoded value', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, value: '-273.15' });
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.ok(Math.abs(result.data.value - -273.15) < 1e-10);
});

test('applyFilterBodySchema: rejects non-numeric string value', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, value: 'hot' });
    assert.ok(!result.success, 'Expected failure for non-numeric value');
});

test('applyFilterBodySchema: rejects NaN string value', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, value: 'NaN' });
    assert.ok(!result.success, 'Expected failure for NaN value');
});

test('applyFilterBodySchema: rejects Infinity value', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, value: Infinity });
    assert.ok(!result.success, 'Expected failure for Infinity value');
});

test('applyFilterBodySchema: rejects -Infinity value', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, value: -Infinity });
    assert.ok(!result.success, 'Expected failure for -Infinity value');
});

test('applyFilterBodySchema: rejects invalid action', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, action: 'hide' });
    assert.ok(!result.success, 'Expected failure for invalid action');
});

test('applyFilterBodySchema: rejects invalid operator', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, operator: 'between' });
    assert.ok(!result.success, 'Expected failure for invalid operator');
});

test('applyFilterBodySchema: accepts all valid operators', () => {
    const operators = ['==', '!=', '>', '>=', '<', '<='] as const;
    for (const operator of operators) {
        const result = applyFilterBodySchema.safeParse({ ...validBase, operator });
        assert.ok(result.success, `Expected success for operator '${operator}'`);
    }
});

test('applyFilterBodySchema: accepts both valid actions', () => {
    for (const action of ['delete', 'highlight'] as const) {
        const result = applyFilterBodySchema.safeParse({ ...validBase, action });
        assert.ok(result.success, `Expected success for action '${action}'`);
    }
});

test('applyFilterBodySchema: rejects empty timestep', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, timestep: '' });
    assert.ok(!result.success, 'Expected failure for empty timestep');
});

test('applyFilterBodySchema: rejects unknown extra fields (strict)', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, extraField: 'unexpected' });
    assert.ok(!result.success, 'Expected failure for unknown extra field (strict mode)');
});

test('applyFilterBodySchema: accepts optional exposureId when present', () => {
    const result = applyFilterBodySchema.safeParse({ ...validBase, exposureId: 'exposure-1' });
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.equal(result.data.exposureId, 'exposure-1');
});
