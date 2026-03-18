import assert from 'node:assert/strict';
import test from 'node:test';
import ParticleFilterService from './ParticleFilterService';
import { ErrorCodes } from '@core/constants/error-codes';

import type { IAtomPropertiesService } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

test('getProperties returns timestep-aware plugin properties with exposure labels', async () => {
    const atomProps = {
        getAnalysisExposureAtomConfigs: async (analysisId: string, timestep?: string) => {
            assert.equal(analysisId, 'analysis-1');
            assert.equal(timestep, '42');

            return [
                {
                    exposureId: 'exposure-a',
                    exposureName: 'Energy',
                    perAtomProperties: ['charge'],
                    schemaKeysMap: new Map()
                },
                {
                    exposureId: 'exposure-b',
                    exposureName: 'Empty',
                    perAtomProperties: [],
                    schemaKeysMap: new Map()
                }
            ];
        }
    } as unknown as IAtomPropertiesService;

    const service = new ParticleFilterService(
        atomProps,
        { getObjectName: () => 'trajectory-dump.lammpstrj' } as unknown as ITrajectoryDumpStorageService,
        {} as IStorageService,
        {} as ISceneArtifactRepository,
        { findById: async () => ({ props: { teamCluster: 'cluster-1' } }) } as unknown as ITrajectoryRepository,
        {} as IAnalysisRepository,
        {
            getTrajectoryMetadata: async () => ({ headers: ['id', 'type'] })
        } as unknown as TrajectoryNativeDaemonService
    );

    const result = await service.getProperties('traj-1', 42, 'analysis-1');

    assert.deepEqual(result, {
        dump: ['id', 'type'],
        perAtom: {
            'exposure-a': ['charge']
        },
        exposureNames: {
            'exposure-a': 'Energy'
        }
    });
});

test('preview rejects a plugin property that is unavailable for the requested timestep', async () => {
    const atomProps = {
        getAnalysisExposureAtomConfigs: async () => ([
            {
                exposureId: 'exposure-a',
                exposureName: 'Energy',
                perAtomProperties: ['charge'],
                schemaKeysMap: new Map()
            }
        ])
    } as unknown as IAtomPropertiesService;

    const service = new ParticleFilterService(
        atomProps,
        { getObjectName: () => 'trajectory-dump.lammpstrj' } as unknown as ITrajectoryDumpStorageService,
        {} as IStorageService,
        {} as ISceneArtifactRepository,
        { findById: async () => ({ props: { teamCluster: 'cluster-1' } }) } as unknown as ITrajectoryRepository,
        {} as IAnalysisRepository,
        {} as TrajectoryNativeDaemonService
    );

    await assert.rejects(
        () => service.preview('traj-1', 42, {
            property: 'spin',
            operator: '>',
            value: 0
        }, 'analysis-1', 'exposure-a'),
        (error: unknown) => {
            assert.equal((error as { code?: string }).code, ErrorCodes.PARTICLE_FILTER_PLUGIN_PROPERTY_UNAVAILABLE);
            assert.match(String((error as Error).message), /not available/);
            return true;
        }
    );
});
