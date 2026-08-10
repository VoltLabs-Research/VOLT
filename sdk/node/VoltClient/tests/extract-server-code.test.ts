import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import extractServerCode from '../src/errors/extract-server-code';

describe('extractServerCode', () => {
    it('returns plain strings as-is', () => {
        assert.equal(extractServerCode('Team::NotFound'), 'Team::NotFound');
    });

    it('prefers code over message', () => {
        assert.equal(extractServerCode({ code: 'A::B', message: 'human' }), 'A::B');
        assert.equal(extractServerCode({ message: 'human' }), 'human');
    });

    it('descends into error / data / details', () => {
        assert.equal(extractServerCode({ error: { code: 'Nested::Code' } }), 'Nested::Code');
        assert.equal(extractServerCode({ data: 'Data::Code' }), 'Data::Code');
        assert.equal(extractServerCode({ details: { message: 'Detail::Msg' } }), 'Detail::Msg');
    });

    it('returns undefined for unrecognised shapes', () => {
        assert.equal(extractServerCode(undefined), undefined);
        assert.equal(extractServerCode(42), undefined);
        assert.equal(extractServerCode({}), undefined);
    });
});
