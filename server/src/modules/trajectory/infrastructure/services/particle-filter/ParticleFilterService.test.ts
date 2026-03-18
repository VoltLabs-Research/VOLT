import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
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
import type { ParticleFilterGroup } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';

interface PreviewFilterInput {
    property: string;
    operator: string;
    value: number;
    externalValues?: Float32Array;
};

interface PreviewFilterOutput {
    mask: Uint8Array;
    matchCount: number;
    totalAtoms: number;
};

interface ExportCall {
    action: 'delete' | 'highlight';
    mask: Uint8Array;
    objectKey: string;
};

interface TestContext {
    service: ParticleFilterService;
    exportCalls: ExportCall[];
    getObjectStreamCalls: string[];
    storageExistsCalls: string[];
    storageStreamCalls: string[];
    upsertCalls: Array<{ objectName: string; data: Record<string, unknown>; }>;
};

interface RecordedArtifactParams {
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterGroup['conditions'];
    property?: string;
    operator?: string;
    value?: number;
    exposureId?: string;
};

interface CreateServiceOptions {
    pluginIndex: Map<number, Record<string, unknown>> | null;
    previewFilter?: (input: PreviewFilterInput) => Promise<PreviewFilterOutput>;
    trajectoryHasCluster?: boolean;
    storageHasObject?: boolean;
};

const pluginOnlyGroup: ParticleFilterGroup = {
    combinator: ParticleFilterCombinator.And,
    conditions: [{
        property: 'charge',
        operator: '>' as const,
        value: 0,
        exposureId: 'exposure-1'
    }]
};

const mixedConditionGroupAnd: ParticleFilterGroup = {
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
};

const mixedConditionGroupOr: ParticleFilterGroup = {
    combinator: ParticleFilterCombinator.Or,
    conditions: mixedConditionGroupAnd.conditions
};

const createService = ({
    pluginIndex,
    previewFilter,
    trajectoryHasCluster = true,
    storageHasObject = true
}: CreateServiceOptions): TestContext => {
    const exportCalls: ExportCall[] = [];
    const getObjectStreamCalls: string[] = [];
    const storageExistsCalls: string[] = [];
    const storageStreamCalls: string[] = [];
    const upsertCalls: Array<{ objectName: string; data: Record<string, unknown>; }> = [];

    const atomProps = {
        getExposureAtomConfig: async () => ({
            exposureId: 'exposure-1',
            exposureName: 'Exposure 1',
            perAtomProperties: ['charge'],
            schemaKeysMap: new Map()
        }),
        getAnalysisExposureAtomConfigs: async () => ([{
            exposureId: 'exposure-1',
            exposureName: 'Exposure 1',
            perAtomProperties: ['charge'],
            schemaKeysMap: new Map()
        }]),
        buildPluginIndexForAtomIds: async () => pluginIndex
    } as unknown as IAtomPropertiesService;

    const daemonPreviewFilter = previewFilter || (async (input: PreviewFilterInput) => {
        assert.ok(input.externalValues instanceof Float32Array);

        return {
            mask: new Uint8Array([1, 0]),
            matchCount: 1,
            totalAtoms: 2
        };
    });

    const storageService = {
        exists: async (_bucket: string, objectKey: string) => {
            storageExistsCalls.push(objectKey);
            return storageHasObject;
        },
        getStream: async (_bucket: string, objectKey: string) => {
            storageStreamCalls.push(objectKey);
            return Readable.from(['storage-stream']);
        }
    } as unknown as IStorageService;

    const sceneArtifactRepository = {
        upsertByObjectName: async (objectName: string, data: Record<string, unknown>) => {
            upsertCalls.push({ objectName, data });
            return {};
        }
    } as unknown as ISceneArtifactRepository;

    const trajectoryRepository = {
        findById: async () => ({
            props: {
                teamCluster: trajectoryHasCluster ? 'cluster-1' : undefined
            }
        })
    } as unknown as ITrajectoryRepository;

    const analysisRepository = {
        findById: async () => ({
            props: {
                teamCluster: 'cluster-1'
            }
        })
    } as unknown as IAnalysisRepository;

    const service = new ParticleFilterService(
        atomProps,
        {
            getObjectName: () => 'trajectory-dump.lammpstrj',
            existsDump: async () => true
        } as unknown as ITrajectoryDumpStorageService,
        storageService,
        sceneArtifactRepository,
        trajectoryRepository,
        analysisRepository,
        {
            getAtomIds: async () => [10, 20, 30],
            previewFilter: daemonPreviewFilter,
            exportParticleFilterModel: async (input: ExportCall) => {
                exportCalls.push(input);
                return { atomsResult: input.mask.reduce((count, value) => count + value, 0) };
            },
            getObjectStream: async (_teamClusterId: string, _bucket: string, objectKey: string) => {
                getObjectStreamCalls.push(objectKey);
                return Readable.from(['daemon-stream']);
            }
        } as unknown as TrajectoryNativeDaemonService
    );

    return {
        service,
        exportCalls,
        getObjectStreamCalls,
        storageExistsCalls,
        storageStreamCalls,
        upsertCalls
    };
};

const getRecordedArtifactParams = (context: TestContext, index: number = 0): RecordedArtifactParams => {
    return context.upsertCalls[index].data.params as RecordedArtifactParams;
};

test('preview throws a clear error when plugin property rows cannot be joined to dump atom ids', async () => {
    const { service } = createService({ pluginIndex: null });

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
        [20, { id: '20', charge: 2.5 }],
        [30, { id: '30', charge: 0 }]
    ]);

    let capturedExternalValues: Float32Array | undefined;
    const { service } = createService({
        pluginIndex,
        previewFilter: async (input) => {
            capturedExternalValues = input.externalValues;

            return {
                mask: new Uint8Array([1, 1, 0]),
                matchCount: 2,
                totalAtoms: 3
            };
        }
    });

    const result = await service.preview('traj-1', 0, pluginOnlyGroup, 'analysis-1');

    assert.deepEqual(result, { matchCount: 2, totalAtoms: 3 });
    assert.ok(capturedExternalValues instanceof Float32Array);
    assert.equal(capturedExternalValues?.[10], 1.25);
    assert.equal(capturedExternalValues?.[20], 2.5);
});

test('preview combines dump and plugin masks with AND / OR without daemon changes', async () => {
    const previewInputs: string[] = [];
    const { service } = createService({
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

    const andResult = await service.preview('traj-1', 0, mixedConditionGroupAnd, 'analysis-1');
    const orResult = await service.preview('traj-1', 0, mixedConditionGroupOr, 'analysis-1');

    assert.deepEqual(previewInputs, ['type', 'charge', 'type', 'charge']);
    assert.deepEqual(andResult, { matchCount: 1, totalAtoms: 3 });
    assert.deepEqual(orResult, { matchCount: 3, totalAtoms: 3 });
});

test('applyAction exports AND composite masks and records composite params', async () => {
    const context = createService({
        pluginIndex: new Map<number, Record<string, unknown>>([
            [10, { charge: '1' }],
            [20, { charge: '0' }],
            [30, { charge: '1' }]
        ]),
        previewFilter: async (input) => {
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

    const result = await context.service.applyAction('traj-1', 0, 'delete', mixedConditionGroupAnd, 'analysis-1');
    const artifactParams = getRecordedArtifactParams(context);

    assert.deepEqual(result, {
        fileId: context.exportCalls[0].objectKey,
        atomsResult: 1,
        action: 'delete'
    });
    assert.deepEqual(Array.from(context.exportCalls[0].mask), [1, 0, 0]);
    assert.match(context.exportCalls[0].objectKey, /particle-filter\/composite\/and-.*-delete\.glb$/);
    assert.equal(artifactParams.combinator, ParticleFilterCombinator.And);
    assert.deepEqual(artifactParams.conditions, mixedConditionGroupAnd.conditions);
});

test('applyAction exports OR composite masks for mixed dump and plugin conditions', async () => {
    const { service, exportCalls } = createService({
        pluginIndex: new Map<number, Record<string, unknown>>([
            [10, { charge: '1' }],
            [20, { charge: '0' }],
            [30, { charge: '1' }]
        ]),
        previewFilter: async (input) => {
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

    await service.applyAction('traj-1', 0, 'highlight', mixedConditionGroupOr, 'analysis-1');

    assert.deepEqual(Array.from(exportCalls[0].mask), [1, 1, 1]);
    assert.match(exportCalls[0].objectKey, /particle-filter\/composite\/or-.*-highlight\.glb$/);
});

test('applyAction keeps legacy single-condition object names and params', async () => {
    const context = createService({
        pluginIndex: new Map<number, Record<string, unknown>>([
            [10, { charge: '1' }],
            [20, { charge: '0' }],
            [30, { charge: '0' }]
        ]),
        previewFilter: async () => ({
            mask: new Uint8Array([1, 0, 0]),
            matchCount: 1,
            totalAtoms: 3
        })
    });

    await context.service.applyAction('traj-1', 0, 'delete', pluginOnlyGroup, 'analysis-1');
    const artifactParams = getRecordedArtifactParams(context);

    assert.match(context.exportCalls[0].objectKey, /particle-filter\/exposure-1\/charge->-0-delete\.glb$/);
    assert.equal(artifactParams.property, 'charge');
    assert.equal(artifactParams.operator, '>');
    assert.equal(artifactParams.value, 0);
    assert.equal(artifactParams.exposureId, 'exposure-1');
});

test('getModelStream resolves composite AND object names through team-cluster storage', async () => {
    const { service, getObjectStreamCalls } = createService({
        pluginIndex: new Map()
    });

    await service.getModelStream('traj-1', 0, mixedConditionGroupAnd, 'delete', 'analysis-1');

    assert.equal(getObjectStreamCalls.length, 1);
    assert.match(getObjectStreamCalls[0], /particle-filter\/composite\/and-.*-delete\.glb$/);
});

test('getModelStream resolves composite OR object names through local storage fallback', async () => {
    const { service, storageExistsCalls, storageStreamCalls } = createService({
        pluginIndex: new Map(),
        trajectoryHasCluster: false
    });

    await service.getModelStream('traj-1', 0, mixedConditionGroupOr, 'highlight', 'analysis-1');

    assert.equal(storageExistsCalls.length, 1);
    assert.equal(storageStreamCalls.length, 1);
    assert.match(storageExistsCalls[0], /particle-filter\/composite\/or-.*-highlight\.glb$/);
    assert.equal(storageExistsCalls[0], storageStreamCalls[0]);
});

test('getModelStream keeps legacy single-condition object names', async () => {
    const { service, getObjectStreamCalls } = createService({
        pluginIndex: new Map()
    });

    await service.getModelStream('traj-1', 0, pluginOnlyGroup, 'delete', 'analysis-1');

    assert.equal(getObjectStreamCalls.length, 1);
    assert.match(getObjectStreamCalls[0], /particle-filter\/exposure-1\/charge->-0-delete\.glb$/);
});
