import 'reflect-metadata';
import TeamClusterDaemonClient from './TeamClusterDaemonClient';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TeamClusterDaemonResponseType } from '@modules/team-cluster/utilities/teamClusterSocket';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { TeamClusterDaemonSocketResponsePayload } from '@modules/team-cluster/utilities/teamClusterSocket';

/** Builds a fake response payload for the mock reverse channel service. */
const buildDaemonResponse = (
    overrides: Partial<TeamClusterDaemonSocketResponsePayload>
): TeamClusterDaemonSocketResponsePayload => ({
    type: 'response',
    requestId: 'req-1',
    ok: false,
    status: 400,
    ...overrides
});

/** Builds a mock reverse channel service whose `command` method resolves with the given payload. */
const buildMockService = (responsePayload: TeamClusterDaemonSocketResponsePayload) => ({
    command: async (_teamClusterId: string, _opts: { command: string; payload?: Record<string, unknown>; responseType?: TeamClusterDaemonResponseType }) => {
        return responsePayload;
    }
});

/** Resolves the ApplicationError thrown by `client.command`, or throws if no error is thrown. */
const catchCommandError = async (
    responsePayload: TeamClusterDaemonSocketResponsePayload
): Promise<ApplicationError> => {
    const mockService = buildMockService(responsePayload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new TeamClusterDaemonClient(mockService as any);

    try {
        await client.command('team-cluster-id', 'test.command');
        throw new Error('Expected command to throw but it did not');
    } catch (err: unknown) {
        assert.ok(err instanceof ApplicationError, `Expected ApplicationError, got: ${err}`);
        return err;
    }
};

test('command maps daemon 422 response to ApplicationError with status 422', async () => {
    const error = await catchCommandError(buildDaemonResponse({
        ok: false,
        status: 422,
        data: { status: 'error', code: 'EMPTY_FILTER_RESULT', message: 'Filter removed all atoms' }
    }));

    assert.equal(error.statusCode, 422);
    assert.equal(error.code, 'EMPTY_FILTER_RESULT');
    assert.equal(error.message, 'Filter removed all atoms');
});

test('command maps daemon 404 response to ApplicationError with status 404', async () => {
    const error = await catchCommandError(buildDaemonResponse({
        ok: false,
        status: 404,
        data: { status: 'error', code: 'DUMP_NOT_FOUND', message: 'Requested dump does not exist' }
    }));

    assert.equal(error.statusCode, 404);
    assert.equal(error.code, 'DUMP_NOT_FOUND');
    assert.equal(error.message, 'Requested dump does not exist');
});

test('command maps daemon 500 response to ApplicationError with status 500', async () => {
    const error = await catchCommandError(buildDaemonResponse({
        ok: false,
        status: 500,
        data: { status: 'error', code: 'INTERNAL_ERROR', message: 'Native binary crashed' }
    }));

    assert.equal(error.statusCode, 500);
    assert.equal(error.code, 'INTERNAL_ERROR');
    assert.equal(error.message, 'Native binary crashed');
});

test('command maps daemon 400 response to ApplicationError with status 400', async () => {
    const error = await catchCommandError(buildDaemonResponse({
        ok: false,
        status: 400,
        data: { status: 'error', code: 'INVALID_PAYLOAD', message: 'Missing required field' }
    }));

    assert.equal(error.statusCode, 400);
    assert.equal(error.code, 'INVALID_PAYLOAD');
    assert.equal(error.message, 'Missing required field');
});

test('command falls back to generic code and message when daemon response is not a structured error payload', async () => {
    const error = await catchCommandError(buildDaemonResponse({
        ok: false,
        status: 503,
        data: null,
        message: 'daemon timed out'
    }));

    assert.equal(error.statusCode, 500);
    assert.equal(error.message, 'daemon timed out');
});

test('command returns data when daemon response is ok and matches envelope shape', async () => {
    const mockService = buildMockService(buildDaemonResponse({
        ok: true,
        status: 200,
        data: { status: 'success', data: { result: 42 } }
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new TeamClusterDaemonClient(mockService as any);
    const result = await client.command<{ result: number }>('team-cluster-id', 'test.command');
    assert.deepEqual(result, { result: 42 });
});
