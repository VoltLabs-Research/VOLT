import 'reflect-metadata';
import TrajectoryDumpStorageService from './TrajectoryDumpStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import assert from 'node:assert/strict';
import test from 'node:test';

/** Builds a minimal mock of IStorageService for existsDump tests. */
const buildMockStorageService = (existsResult: boolean) => ({
    exists: async (_bucket: string, _objectName: string) => existsResult,
    upload: async () => {},
    listByPrefix: async function* () {},
    getStream: async () => { throw new Error('not implemented'); },
    getBuffer: async () => { throw new Error('not implemented'); },
    delete: async () => {},
    deleteByPrefix: async () => {},
    getPublicURL: () => '',
    getStat: async () => { throw new Error('not implemented'); },
    download: async () => {}
});

/** Builds a minimal mock of ITempFileService. */
const buildMockTempFileService = () => ({
    getDirPath: (name: string) => `/tmp/${name}`,
    ensureDir: async () => {}
});

/** Builds a minimal mock of ITrajectoryRepository returning a trajectory without a cluster. */
const buildMockTrajectoryRepo = (teamCluster: string | undefined = undefined) => ({
    findById: async (_id: string) => ({
        props: { teamCluster }
    })
});

/** Builds a minimal mock of TeamClusterDaemonClient for daemon-mode existsDump tests. */
const buildMockDaemonClient = (returnedKeys: string[]) => ({
    command: async (
        _teamClusterId: string,
        _command: string,
        _payload?: Record<string, unknown>
    ) => ({ keys: returnedKeys })
});

/**
 * Instantiates TrajectoryDumpStorageService with the minimum required mocks
 * to test existsDump without touching real MinIO or daemon connections.
 */
const buildService = ({
    storageExists = false,
    teamCluster = undefined as string | undefined,
    daemonKeys = [] as string[]
} = {}) => {
    const storage = buildMockStorageService(storageExists);
    const temp = buildMockTempFileService();
    const repo = buildMockTrajectoryRepo(teamCluster);
    const daemon = buildMockDaemonClient(daemonKeys);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new TrajectoryDumpStorageService(storage as any, temp as any, repo as any, daemon as any);
};

test('existsDump returns false when dump is absent in local storage', async () => {
    const service = buildService({ storageExists: false });
    const result = await service.existsDump('traj-1', '100');
    assert.equal(result, false);
});

test('existsDump returns true when dump is present in local storage', async () => {
    const service = buildService({ storageExists: true });
    const result = await service.existsDump('traj-1', '100');
    assert.equal(result, true);
});

test('existsDump returns false when daemon object list does not contain the dump key', async () => {
    const service = buildService({
        teamCluster: 'cluster-abc',
        daemonKeys: ['trajectory-traj-1/timestep-999.dump.gz']
    });
    const result = await service.existsDump('traj-1', '100');
    assert.equal(result, false);
});

test('existsDump returns true when daemon object list contains the exact dump key', async () => {
    const expectedKey = 'trajectory-traj-1/timestep-100.dump.gz';
    const service = buildService({
        teamCluster: 'cluster-abc',
        daemonKeys: [expectedKey]
    });
    const result = await service.existsDump('traj-1', '100');
    assert.equal(result, true);
});

test('existsDump passes correct bucket and prefix to daemon object.list command', async () => {
    let capturedPayload: Record<string, unknown> | undefined;

    const mockDaemon = {
        command: async (
            _teamClusterId: string,
            _command: string,
            payload?: Record<string, unknown>
        ) => {
            capturedPayload = payload;
            return { keys: [] };
        }
    };

    const storage = buildMockStorageService(false);
    const temp = buildMockTempFileService();
    const repo = buildMockTrajectoryRepo('cluster-abc');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new TrajectoryDumpStorageService(storage as any, temp as any, repo as any, mockDaemon as any);
    await service.existsDump('traj-99', '42');

    assert.ok(capturedPayload, 'Daemon was not called');
    assert.equal(capturedPayload.bucket, SYS_BUCKETS.DUMPS);
    assert.equal(capturedPayload.prefix, 'trajectory-traj-99/timestep-42.dump.gz');
});

test('existsDump uses local storage (not daemon) when trajectory has no cluster', async () => {
    let daemonCalled = false;

    const mockDaemon = {
        command: async () => {
            daemonCalled = true;
            return { keys: [] };
        }
    };

    const storage = buildMockStorageService(true);
    const temp = buildMockTempFileService();
    const repo = buildMockTrajectoryRepo(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new TrajectoryDumpStorageService(storage as any, temp as any, repo as any, mockDaemon as any);
    const result = await service.existsDump('traj-1', '50');

    assert.equal(result, true);
    assert.equal(daemonCalled, false, 'Daemon should not be called for local-mode trajectories');
});
