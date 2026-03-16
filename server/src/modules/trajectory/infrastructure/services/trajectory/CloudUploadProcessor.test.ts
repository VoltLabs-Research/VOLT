import 'reflect-metadata';
import { ErrorCodes } from '@core/constants/error-codes';
import CloudUploadProcessor from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadProcessor';
import { WorkerFailureError } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';

interface CommandCall {
    command: string;
    payload?: Record<string, unknown>;
    teamClusterId: string;
};

class TeamClusterDaemonClientStub {
    public readonly calls: CommandCall[] = [];

    constructor(private readonly handler: (call: CommandCall) => Promise<unknown>) {}

    async command<T>(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<T> {
        const call = { command, payload, teamClusterId };
        this.calls.push(call);
        return this.handler(call) as Promise<T>;
    }
};

const createDumpStorage = (): ITrajectoryDumpStorageService => {
    return {
        getObjectName: (trajectoryId: string, timestep: string) => `${trajectoryId}/${timestep}.dump.gz`,
        getPrefix: () => 'prefix',
        getCachePath: () => 'cache-path',
        getDump: async () => null,
        getDumpStream: async () => {
            throw new Error('Not implemented');
        },
        listDumps: async () => [],
        existsDump: async () => false
    };
};

const createTempFrameFile = async (): Promise<string> => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'cloud-upload-processor-test-'));
    const tempFilePath = path.join(tempDirectory, 'frame.dump');

    await fs.writeFile(tempFilePath, 'frame-data');

    return tempFilePath;
};

test('CloudUploadProcessor: retries transient daemon transport failures before succeeding', async () => {
    const tempFilePath = await createTempFrameFile();
    let failureCount = 0;
    const daemonClient = new TeamClusterDaemonClientStub(async (call) => {
        if (call.command === 'object.upload' && failureCount < 2) {
            failureCount += 1;
            throw new Error('Team cluster daemon connection was lost');
        }

        return { ok: true };
    });
    const processor = new CloudUploadProcessor(
        createDumpStorage(),
        daemonClient
    );

    try {
        await processor.process({
            frameFilePath: tempFilePath,
            teamClusterId: 'cluster-1',
            teamId: 'team-1',
            timestep: 1,
            trajectoryId: 'trajectory-1',
            trajectoryName: 'Trajectory'
        });
    } finally {
        await fs.rm(path.dirname(tempFilePath), { recursive: true, force: true });
    }

    assert.equal(
        daemonClient.calls.filter((call) => call.command === 'object.upload').length,
        3
    );
    assert.equal(
        daemonClient.calls.filter((call) => call.command === 'trajectory.native.preprocess').length,
        1
    );
});

test('CloudUploadProcessor: throws a trajectory transport failure after retries are exhausted', async () => {
    const tempFilePath = await createTempFrameFile();
    const daemonClient = new TeamClusterDaemonClientStub(async () => {
        throw new Error('Team cluster daemon reverse channel is not connected');
    });
    const processor = new CloudUploadProcessor(
        createDumpStorage(),
        daemonClient
    );

    try {
        await assert.rejects(
            processor.process({
                frameFilePath: tempFilePath,
                teamClusterId: 'cluster-1',
                teamId: 'team-1',
                timestep: 2,
                trajectoryId: 'trajectory-2',
                trajectoryName: 'Trajectory'
            }),
            (error: unknown) => {
                assert.ok(error instanceof WorkerFailureError);
                assert.equal(error.failure.code, ErrorCodes.TRAJECTORY_DAEMON_TRANSPORT_FAILED);
                assert.equal(error.failure.details, 'Team cluster daemon reverse channel is not connected');
                return true;
            }
        );
    } finally {
        await fs.rm(path.dirname(tempFilePath), { recursive: true, force: true });
    }

    assert.equal(daemonClient.calls.length, 3);
});
