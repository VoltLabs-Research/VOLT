import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getHttpFallbackCode, toParams } from '../src/core/http-utils';

describe('getHttpFallbackCode', () => {
    it('maps known status codes', () => {
        assert.equal(getHttpFallbackCode(404), 'Http::404');
        assert.equal(getHttpFallbackCode(503), 'Http::503');
    });

    it('falls back to a generic server error', () => {
        assert.equal(getHttpFallbackCode(418), 'Internal::Server::Error');
    });
});

describe('toParams', () => {
    it('returns undefined for no query', () => {
        assert.equal(toParams(undefined), undefined);
    });

    it('skips null and undefined values', () => {
        const params = toParams({ a: 1, b: null, c: undefined, d: 'x' });
        assert.equal(params?.toString(), 'a=1&d=x');
    });

    it('appends array entries individually', () => {
        const params = toParams({ tag: ['a', 'b'] });
        assert.equal(params?.getAll('tag').join(','), 'a,b');
    });
});
