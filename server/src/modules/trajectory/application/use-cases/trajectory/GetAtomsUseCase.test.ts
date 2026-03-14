import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ErrorCodes } from '@core/constants/error-codes';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import type { AtomPageResult } from '@modules/trajectory/domain/contracts/trajectory';
import Trajectory, { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { GetAtomsInputDTO } from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import type { ITrajectoryReader } from '@modules/trajectory/domain/port/trajectory/ITrajectoryReader';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface RepositoryFindByIdOptions {
    populate?: string | string[];
    select?: string[];
};

const createTrajectoryRepository = (trajectory: Trajectory | null): ITrajectoryRepository => {
    return {
        findById: async (_id: string, _options?: RepositoryFindByIdOptions) => trajectory,
        findOne: async () => null,
        findAll: async () => ({ data: [], total: 0, page: 1, totalPages: 0, limit: 10 }),
        export: async () => [],
        create: async () => {
            throw new Error('Not implemented');
        },
        updateById: async () => null,
        updateMany: async () => 0,
        insertMany: async () => {},
        deleteById: async () => false,
        deleteMany: async () => 0,
        count: async () => 0,
        countGroupedBy: async () => new Map(),
        exists: async () => false,
        createWithId: async () => {
            throw new Error('Not implemented');
        }
    };
};

const createAnalysisRepository = (analysis: Analysis | null): IAnalysisRepository => {
    return {
        findById: async (_id: string, _options?: RepositoryFindByIdOptions) => analysis,
        findOne: async () => null,
        findAll: async () => ({ data: [], total: 0, page: 1, totalPages: 0, limit: 10 }),
        export: async () => [],
        create: async () => {
            throw new Error('Not implemented');
        },
        updateById: async () => null,
        updateMany: async () => 0,
        insertMany: async () => {},
        deleteById: async () => false,
        deleteMany: async () => 0,
        count: async () => 0,
        countGroupedBy: async () => new Map(),
        exists: async () => false,
        getCompletedFramesByCluster: async () => ({})
    };
};

const createTrajectoryReader = (): ITrajectoryReader => {
    return {
        readPage: async (): Promise<AtomPageResult> => ({
            atoms: [
                {
                    id: 1,
                    type: 1,
                    x: 0,
                    y: 0,
                    z: 0
                }
            ],
            totalAtoms: 1,
            nativeProperties: []
        })
    };
};

const baseInput: GetAtomsInputDTO = {
    trajectoryId: 'trajectory-1',
    analysisId: 'analysis-1',
    timestep: 0,
    page: 1,
    limit: 100
};

const createTrajectory = (trajectoryId: string): Trajectory => {
    return new Trajectory(trajectoryId, {
        name: 'Trajectory',
        team: 'team-1',
        folder: null,
        teamCluster: 'cluster-1',
        createdBy: 'user-1',
        status: TrajectoryStatus.Completed,
        isPublic: false,
        frames: [],
        analysis: [],
        rasterSceneViews: 0,
        stats: {
            totalFiles: 1,
            totalSize: 1
        },
        updatedAt: new Date(),
        createdAt: new Date()
    });
};

const createAnalysis = (analysisId: string, trajectoryId: string): Analysis => {
    return new Analysis(analysisId, {
        plugin: 'plugin-1',
        teamCluster: 'cluster-1',
        config: {},
        trajectory: trajectoryId,
        createdBy: 'user-1',
        team: 'team-1',
        status: 'completed'
    });
};

test('GetAtomsUseCase: returns bad request when analysis trajectory does not match', async () => {
    const trajectory = createTrajectory('trajectory-1');
    const analysis = createAnalysis('analysis-1', 'trajectory-2');

    const useCase = new GetAtomsUseCase(
        createTrajectoryReader(),
        createTrajectoryRepository(trajectory),
        createAnalysisRepository(analysis)
    );

    const result = await useCase.execute(baseInput);

    assert.ok(!result.success, 'Expected request to fail for mismatched analysis trajectory');
    assert.equal(result.error.code, ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH);
    assert.equal(result.error.statusCode, 400);
    assert.equal(result.error.message, 'Analysis does not belong to the requested trajectory');
});

test('GetAtomsUseCase: returns atoms when analysis belongs to requested trajectory', async () => {
    const trajectory = createTrajectory('trajectory-1');
    const analysis = createAnalysis('analysis-1', 'trajectory-1');

    const useCase = new GetAtomsUseCase(
        createTrajectoryReader(),
        createTrajectoryRepository(trajectory),
        createAnalysisRepository(analysis)
    );

    const result = await useCase.execute(baseInput);

    assert.ok(result.success, 'Expected request to succeed when analysis matches trajectory');
    assert.equal(result.value.data.length, 1);
    assert.deepEqual(result.value.data[0], {
        id: 1,
        type: 1,
        x: 0,
        y: 0,
        z: 0
    });
});
