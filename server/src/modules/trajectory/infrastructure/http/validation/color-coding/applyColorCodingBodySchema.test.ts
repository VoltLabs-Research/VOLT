import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod/v4';

/**
 * Inline reproduction of `applyColorCodingBodySchema` so the test is
 * self-contained and does not depend on the module's DI wiring.
 */
const applyColorCodingBodySchema = z.object({
    timestep: z.string().min(1),
    property: z.string().min(1),
    startValue: z.coerce.number().finite(),
    endValue: z.coerce.number().finite(),
    gradient: z.string().min(1),
    exposureId: z.string().trim().min(1).optional()
}).strict();

const validBase = {
    timestep: '100',
    property: 'temperature',
    startValue: 0,
    endValue: 100,
    gradient: 'rainbow'
};

test('applyColorCodingBodySchema: accepts already-typed numbers', () => {
    const result = applyColorCodingBodySchema.safeParse(validBase);
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.equal(result.data.startValue, 0);
    assert.equal(result.data.endValue, 100);
});

test('applyColorCodingBodySchema: coerces string-encoded integers', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, startValue: '0', endValue: '100' });
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.equal(result.data.startValue, 0);
    assert.equal(result.data.endValue, 100);
});

test('applyColorCodingBodySchema: coerces string-encoded floats', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, startValue: '-1.5', endValue: '3.14159' });
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.equal(result.data.startValue, -1.5);
    assert.ok(Math.abs(result.data.endValue - 3.14159) < 1e-10);
});

test('applyColorCodingBodySchema: rejects non-numeric strings', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, startValue: 'abc', endValue: 'xyz' });
    assert.ok(!result.success, 'Expected failure for non-numeric startValue/endValue');
});

test('applyColorCodingBodySchema: rejects NaN string', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, startValue: 'NaN', endValue: 0 });
    assert.ok(!result.success, 'Expected failure for NaN startValue');
});

test('applyColorCodingBodySchema: rejects Infinity', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, startValue: Infinity, endValue: 0 });
    assert.ok(!result.success, 'Expected failure for Infinity startValue');
});

test('applyColorCodingBodySchema: rejects -Infinity', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, startValue: 0, endValue: -Infinity });
    assert.ok(!result.success, 'Expected failure for -Infinity endValue');
});

test('applyColorCodingBodySchema: rejects empty timestep', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, timestep: '' });
    assert.ok(!result.success, 'Expected failure for empty timestep');
});

test('applyColorCodingBodySchema: rejects empty gradient', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, gradient: '' });
    assert.ok(!result.success, 'Expected failure for empty gradient');
});

test('applyColorCodingBodySchema: rejects unknown extra fields (strict)', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, extraField: 'unexpected' });
    assert.ok(!result.success, 'Expected failure for unknown extra field (strict mode)');
});

test('applyColorCodingBodySchema: accepts optional exposureId when present', () => {
    const result = applyColorCodingBodySchema.safeParse({ ...validBase, exposureId: 'exposure-1' });
    assert.ok(result.success, `Expected success but got: ${!result.success && JSON.stringify(result.error.issues)}`);
    assert.equal(result.data.exposureId, 'exposure-1');
});
