import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import ApiError from '../src/errors/ApiError';

describe('ApiError', () => {
    it('exposes code, status and a friendly message for SDK-generated codes', () => {
        const err = new ApiError('Http::404', 404);
        assert.equal(err.code, 'Http::404');
        assert.equal(err.status, 404);
        assert.equal(err.getFriendlyMessage(), 'Resource not found');
        assert.ok(err instanceof Error);
    });

    it('falls back to the code as the message for unknown server codes', () => {
        const err = new ApiError('Team::SomethingNew');
        assert.equal(err.message, 'Team::SomethingNew');
    });

    it('classifies permission-denied codes', () => {
        assert.equal(new ApiError('Team::AccessDenied').isPermissionDenied(), true);
        assert.equal(new ApiError('Http::403').isPermissionDenied(), true);
        assert.equal(new ApiError('Http::404').isPermissionDenied(), false);
        assert.equal(ApiError.isRBACError(new ApiError('RBAC::InsufficientPermissions')), true);
        assert.equal(ApiError.isRBACError(new Error('x')), false);
    });
});
