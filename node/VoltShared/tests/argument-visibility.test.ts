import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    getVisibleArguments,
    isArgumentVisible,
    matchesVisibilityCondition,
    sanitizeVisibleArgumentConfig
} from '../src/argument-visibility';

describe('matchesVisibilityCondition', () => {
    it('handles equals / notEquals', () => {
        assert.equal(matchesVisibilityCondition({ operator: 'equals', value: 'fcc' }, 'fcc'), true);
        assert.equal(matchesVisibilityCondition({ operator: 'equals', value: 'fcc' }, 'bcc'), false);
        assert.equal(matchesVisibilityCondition({ operator: 'notEquals', value: 'fcc' }, 'bcc'), true);
    });

    it('handles in / notIn for scalars and arrays', () => {
        assert.equal(matchesVisibilityCondition({ operator: 'in', values: ['a', 'b'] }, 'b'), true);
        assert.equal(matchesVisibilityCondition({ operator: 'in', values: ['a', 'b'] }, 'c'), false);
        assert.equal(matchesVisibilityCondition({ operator: 'in', values: ['a', 'b'] }, ['c', 'a']), true);
        assert.equal(matchesVisibilityCondition({ operator: 'notIn', values: ['a'] }, ['b', 'c']), true);
    });

    it('defaults to visible for unknown operators', () => {
        assert.equal(matchesVisibilityCondition({ operator: 'weird' }, 'x'), true);
    });
});

describe('isArgumentVisible / getVisibleArguments', () => {
    const definitions = [
        { argument: 'mode', default: 'simple' },
        { argument: 'advanced', visibleWhen: { argument: 'mode', operator: 'equals', value: 'expert' } }
    ];

    it('hides arguments whose controlling value does not match', () => {
        assert.equal(isArgumentVisible(definitions[1], definitions, {}), false);
        assert.equal(isArgumentVisible(definitions[1], definitions, { mode: 'expert' }), true);
    });

    it('filters the visible set', () => {
        const visible = getVisibleArguments(definitions, { mode: 'expert' }).map((d) => d.argument);
        assert.deepEqual(visible, ['mode', 'advanced']);
    });

    it('sanitizes to only the visible, defined values', () => {
        const sanitized = sanitizeVisibleArgumentConfig(definitions, { mode: 'simple', advanced: true });
        assert.deepEqual(sanitized, { mode: 'simple' });
    });
});
