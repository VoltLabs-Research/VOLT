import assert from 'node:assert/strict';
import test from 'node:test';
import { DaemonCommandError } from './DaemonCommandError';
import { adaptReverseChannelHandler } from './reverseChannelCommandAdapter';

test('adaptReverseChannelHandler maps DaemonCommandError to its operational status code', async () => {
    const handler = adaptReverseChannelHandler({
        command: 'analysis.start',
        execute: async () => {
            throw DaemonCommandError.unprocessableEntity(
                'Analysis::Start::EmptyExecutionPlan',
                'No items after daemon workflow planning'
            );
        }
    });

    const result = await handler.handle({}, {
        command: 'analysis.start',
        requestId: 'request-1'
    });

    assert.deepEqual(result, {
        status: 422,
        data: {
            status: 'error',
            code: 'Analysis::Start::EmptyExecutionPlan',
            message: 'No items after daemon workflow planning'
        }
    });
});
