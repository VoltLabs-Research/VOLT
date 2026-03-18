import assert from 'node:assert/strict';
import test from 'node:test';
import ParticleFilterService from './ParticleFilterService';
import { ErrorCodes } from '@core/constants/error-codes';

import type { IAtomPropertiesService, FilterExpression } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

const expression: FilterExpression = {
    property: 'charge',
    operator: '>',
    value: 0
};

const createService = ({
    pluginIndex,
    previewResult
}: {
    pluginIndex: Map<number, Record<string, unknown>> | null;
    previewResult?: { matchCount: number; totalAtoms: number; };
}) => {
    const atomProps = {
        getExposureAtomConfig: async () => ({
            exposureId: 'exposure-1',
            exposureName: 'Exposure 1',
            perAtomProperties: ['charge'],
            schemaKeysMap: new Map()
        }),
        buildPluginIndexForAtomIds: async () => pluginIndex
    } as unknown as IAtomPropertiesService;

    const trajectoryRepository = {
        findById: async () => ({ props: { teamCluster: 'cluster-1' } })
    } as unknown as ITrajectoryRepository;

    const dumpStorage = {
        getObjectName: () => 'trajectory-dump.lammpstrj'
    } as unknown as ITrajectoryDumpStorageService;

    const daemon = {
        getAtomIds: async () => [10, 20],
        previewFilter: async (input: { externalValues?: Float32Array; }) => {
            assert.ok(input.externalValues instanceof Float32Array);
            return {
                mask: new Uint8Array([1, 0]),
                matchCount: previewResult?.matchCount ?? 1,
                totalAtoms: previewResult?.totalAtoms ?? 2
            };
        }
    } as unknown as TrajectoryNativeDaemonService;

    return new ParticleFilterService(
        atomProps,
        dumpStorage,
        {} as IStorageService,
        {} as ISceneArtifactRepository,
        trajectoryRepository,
        {} as IAnalysisRepository,
        daemon
    );
};

test('preview throws a clear error when plugin property rows cannot be joined to dump atom ids', async () => {
    const service = createService({ pluginIndex: null });

    await assert.rejects(
        () => service.preview('traj-1', 0, expression, 'analysis-1', 'exposure-1'),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, ErrorCodes.PARTICLE_FILTER_PLUGIN_PROPERTY_UNMAPPABLE);
            assert.match(String((error as Error).message), /cannot be mapped to trajectory atom ids/);
            return true;
        }
    );
});

test('preview forwards remapped plugin values when the atom-id join succeeds', async () => {
    const pluginIndex = new Map<number, Record<string, unknown>>([
        [10, { id: '10', charge: '1.25' }],
        [20, { id: '20', charge: 2.5 }]
    ]);

    let capturedExternalValues: Float32Array | undefined;
    const atomProps = {
        getExposureAtomConfig: async () => ({
            exposureId: 'exposure-1',
            exposureName: 'Exposure 1',
            perAtomProperties: ['charge'],
            schemaKeysMap: new Map()
        }),
        buildPluginIndexForAtomIds: async () => pluginIndex
    } as unknown as IAtomPropertiesService;

    const service = new ParticleFilterService(
        atomProps,
        { getObjectName: () => 'trajectory-dump.lammpstrj' } as unknown as ITrajectoryDumpStorageService,
        {} as IStorageService,
        {} as ISceneArtifactRepository,
        { findById: async () => ({ props: { teamCluster: 'cluster-1' } }) } as unknown as ITrajectoryRepository,
        {} as IAnalysisRepository,
        {
            getAtomIds: async () => [10, 20],
            previewFilter: async (input: { externalValues?: Float32Array; }) => {
                capturedExternalValues = input.externalValues;
                return {
                    mask: new Uint8Array([1, 1]),
                    matchCount: 2,
                    totalAtoms: 2
                };
            }
        } as unknown as TrajectoryNativeDaemonService
    );

    const result = await service.preview('traj-1', 0, expression, 'analysis-1', 'exposure-1');

    assert.deepEqual(result, { matchCount: 2, totalAtoms: 2 });
    assert.ok(capturedExternalValues instanceof Float32Array);
    assert.equal(capturedExternalValues?.[10], 1.25);
    assert.equal(capturedExternalValues?.[20], 2.5);
});
