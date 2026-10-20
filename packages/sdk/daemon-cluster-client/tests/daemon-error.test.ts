import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DaemonClientError } from '../src/errors/DaemonClientError';
import { DaemonClientErrorCode } from '../src/errors/error-codes';

describe('DaemonClientError factories', () => {
    it('carries a discriminable code per failure mode', () => {
        assert.equal(DaemonClientError.socketNotReady().code, DaemonClientErrorCode.SocketNotReady);
        assert.equal(DaemonClientError.commandTimeout('runtime.x').code, DaemonClientErrorCode.CommandTimeout);
        assert.equal(DaemonClientError.commandRejected('runtime.x').code, DaemonClientErrorCode.CommandRejected);
        assert.equal(DaemonClientError.emitFailed().code, DaemonClientErrorCode.EmitFailed);
        assert.equal(DaemonClientError.enrollmentFailed('boom').code, DaemonClientErrorCode.EnrollmentFailed);
    });

    it('distinguishes heartbeat failures from command timeouts', () => {
        const err = DaemonClientError.heartbeatFailed(new Error('socket down'));
        assert.equal(err.code, DaemonClientErrorCode.HeartbeatFailed);
        assert.match(err.message, /socket down/);
        assert.notEqual(err.code, DaemonClientErrorCode.CommandTimeout);
    });

    it('is an Error and preserves the cause', () => {
        const cause = new Error('root');
        const err = DaemonClientError.enrollmentFailed('failed', cause);
        assert.ok(err instanceof Error);
        assert.equal(err.cause, cause);
        assert.equal(err.name, 'DaemonClientError');
    });
});
