import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import ParticleFilterService from './ParticleFilterService';
import { ErrorCodes } from '@core/constants/error-codes';
import { ParticleFilterCombinator } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';

import type { IAtomPropertiesService } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

const pluginOnlyGroup = {
    combinator: ParticleFilterCombinator.And,
    conditions: [{
        property: 'charge',
        operator: '>' as const,
        value: 0,
        exposureId: 'exposure-1'
    }]
};

const createService = ({
    pluginIndex,
    previewFilter
}: {
    pluginIndex: Map<number, Record<string, unknown>> | null;
    previewFilter?: (input: { property: string; operator: string; value: number; externalValues?: Float32Array; }) => Promise<{
        mask: Uint8Array;
        matchCount: number;
        totalAtoms: number;
    }>;
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

    const daemonPreviewFilter = previewFilter || (async (input: { externalValues?: Float32Array; }) => {
        assert.ok(input.externalValues instanceof Float32Array);

        return {
            mask: new Uint8Array([1, 0]),
            matchCount: 1,
            totalAtoms: 2
        };
    });

    return new ParticleFilterService(
        atomProps,
        { getObjectName: () => 'trajectory-dump.lammpstrj' } as unknown as ITrajectoryDumpStorageService,
        {} as IStorageService,
        {} as ISceneArtifactRepository,
        { findById: async () => ({ props: { teamCluster: 'cluster-1' } }) } as unknown as ITrajectoryRepository,
        {} as IAnalysisRepository,
        {
            getAtomIds: async () => [10, 20],
            previewFilter: daemonPreviewFilter
        } as unknown as TrajectoryNativeDaemonService
    );
};

test('preview throws a clear error when plugin property rows cannot be joined to dump atom ids', async () => {
    const service = createService({ pluginIndex: null });

    await assert.rejects(
        () => service.preview('traj-1', 0, pluginOnlyGroup, 'analysis-1'),
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
    const service = createService({
        pluginIndex,
        previewFilter: async (input) => {
            capturedExternalValues = input.externalValues;

            return {
                mask: new Uint8Array([1, 1]),
                matchCount: 2,
                totalAtoms: 2
            };
        }
    });

    const result = await service.preview('traj-1', 0, pluginOnlyGroup, 'analysis-1');

    assert.deepEqual(result, { matchCount: 2, totalAtoms: 2 });
    assert.ok(capturedExternalValues instanceof Float32Array);
    assert.equal(capturedExternalValues?.[10], 1.25);
    assert.equal(capturedExternalValues?.[20], 2.5);
});

test('preview combines dump and plugin masks with AND / OR without daemon changes', async () => {
    const previewInputs: string[] = [];
    const service = createService({
        pluginIndex: new Map<number, Record<string, unknown>>([
            [10, { charge: '1' }],
            [20, { charge: '0' }],
            [30, { charge: '1' }]
        ]),
        previewFilter: async (input) => {
            previewInputs.push(input.property);

            if (input.property === 'type') {
                return {
                    mask: new Uint8Array([1, 1, 0]),
                    matchCount: 2,
                    totalAtoms: 3
                };
            }

            return {
                mask: new Uint8Array([1, 0, 1]),
                matchCount: 2,
                totalAtoms: 3
            };
        }
    });

    const andResult = await service.preview('traj-1', 0, {
        combinator: ParticleFilterCombinator.And,
        conditions: [
            {
                property: 'type',
                operator: '==',
                value: 1
            },
            {
                property: 'charge',
                operator: '>',
                value: 0,
                exposureId: 'exposure-1'
            }
        ]
    }, 'analysis-1');
    const orResult = await service.preview('traj-1', 0, {
        combinator: ParticleFilterCombinator.Or,
        conditions: [
            {
                property: 'type',
                operator: '==',
                value: 1
            },
            {
                property: 'charge',
                operator: '>',
                value: 0,
                exposureId: 'exposure-1'
            }
        ]
    }, 'analysis-1');

    assert.deepEqual(previewInputs, ['type', 'charge', 'type', 'charge']);
    assert.deepEqual(andResult, { matchCount: 1, totalAtoms: 3 });
    assert.deepEqual(orResult, { matchCount: 3, totalAtoms: 3 });
});
