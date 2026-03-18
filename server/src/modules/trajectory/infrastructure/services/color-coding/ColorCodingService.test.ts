import assert from 'node:assert/strict';
import test from 'node:test';
import ColorCodingService from './ColorCodingService';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { IAtomPropertiesService } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import type { IStorageService } from '@shared/domain/port/IStorageService';

interface CreateServiceOptions {
    buildPluginIndexResult?: Map<number, Record<string, unknown>> | null;
    dumpAtomIds?: number[];
};

const createService = ({
    buildPluginIndexResult = new Map<number, Record<string, unknown>>(),
    dumpAtomIds = [10, 20, 30]
}: CreateServiceOptions = {}) => {
    let capturedExternalValues: Float32Array | undefined;

    const atomProps = {
        getAnalysisExposureAtomConfigs: async () => ([
            {
                exposureId: 'exposure-1',
                exposureName: 'Exposure 1',
                perAtomProperties: ['charge'],
                schemaKeysMap: new Map()
            }
        ]),
        buildPluginIndexForAtomIds: async () => buildPluginIndexResult
    } as unknown as IAtomPropertiesService;

    const dumpStorage = {
        existsDump: async () => true,
        getObjectName: () => 'trajectory-dump.lammpstrj'
    } as unknown as ITrajectoryDumpStorageService;

    const trajectoryRepository = {
        findById: async () => ({ props: { teamCluster: 'cluster-1' } })
    } as unknown as ITrajectoryRepository;

    const analysisRepository = {
        findById: async () => ({ props: { teamCluster: 'cluster-1' } })
    } as unknown as IAnalysisRepository;

    const daemon = {
        getAtomIds: async () => dumpAtomIds,
        exportColoredModel: async (input: { externalValues?: Float32Array; }) => {
            capturedExternalValues = input.externalValues;
        }
    } as unknown as TrajectoryNativeDaemonService;

    const service = new ColorCodingService(
        atomProps,
        dumpStorage,
        {} as IStorageService,
        {
            upsertByObjectName: async () => undefined
        } as unknown as ISceneArtifactRepository,
        trajectoryRepository,
        analysisRepository,
        daemon
    );

    return {
        service,
        getCapturedExternalValues: () => capturedExternalValues
    };
};

test('createColoredModel remaps plugin values by atom id and preserves missing rows as NaN', async () => {
    const pluginIndex = new Map<number, Record<string, unknown>>([
        [10, { id: '10', charge: '1.25' }],
        [30, { id: '30', charge: 3.5 }]
    ]);
    const { service, getCapturedExternalValues } = createService({
        buildPluginIndexResult: pluginIndex
    });

    await service.createColoredModel(
        'traj-1',
        42,
        'charge',
        0,
        10,
        'viridis',
        'analysis-1',
        'exposure-1'
    );

    const externalValues = getCapturedExternalValues();
    assert.ok(externalValues instanceof Float32Array);
    assert.equal(externalValues?.[10], 1.25);
    assert.equal(externalValues?.[30], 3.5);
    assert.equal(Number.isNaN(externalValues?.[20] ?? Number.NaN), true);
});

test('getStats ignores missing plugin rows instead of treating them as zero', async () => {
    const pluginIndex = new Map<number, Record<string, unknown>>([
        [10, { id: '10', charge: 1.25 }],
        [30, { id: '30', charge: 3.5 }]
    ]);
    const { service } = createService({
        buildPluginIndexResult: pluginIndex
    });

    const stats = await service.getStats(
        'traj-1',
        42,
        'charge',
        'modifier',
        'analysis-1',
        'exposure-1'
    );

    assert.deepEqual(stats, { min: 1.25, max: 3.5 });
});

test('createColoredModel keeps dump properties unchanged when no plugin exposure is requested', async () => {
    const { service, getCapturedExternalValues } = createService();

    await service.createColoredModel(
        'traj-1',
        42,
        'vx',
        -1,
        1,
        'viridis'
    );

    assert.equal(getCapturedExternalValues(), undefined);
});
