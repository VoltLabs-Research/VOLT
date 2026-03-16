import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamMember from '@modules/team/domain/entities/team-member/TeamMember';
import { GetPublicCanvasBootstrapUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasBootstrapUseCase';
import { PublicCanvasAccessMode } from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasBootstrapDTO';
import Trajectory, { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface RepositoryFindByIdOptions {
    populate?: string | string[];
    select?: string[];
};

const TRAJECTORY_ID = '507f1f77bcf86cd799439011';
const TEAM_ID = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439013';

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

const createTeamMemberRepository = (member: TeamMember | null): ITeamMemberRepository => {
    return {
        findById: async () => member,
        findOne: async () => member,
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
        findByUserId: async () => member ? [member] : [],
        deleteByUserId: async () => {},
        getTeamIdsByUserId: async () => member ? [TEAM_ID] : []
    };
};

const createTrajectory = (isPublic: boolean): Trajectory => {
    return new Trajectory(TRAJECTORY_ID, {
        name: 'Trajectory',
        team: TEAM_ID,
        folder: null,
        teamCluster: '507f1f77bcf86cd799439014',
        createdBy: USER_ID,
        status: TrajectoryStatus.Completed,
        isPublic,
        frames: [{
            timestep: 0,
            natoms: 42,
            simulationCell: '507f1f77bcf86cd799439015'
        }],
        analysis: ['507f1f77bcf86cd799439016'],
        rasterSceneViews: 0,
        stats: {
            totalFiles: 1,
            totalSize: 1
        },
        updatedAt: new Date(),
        createdAt: new Date()
    });
};

const createTeamMember = (): TeamMember => {
    return new TeamMember('507f1f77bcf86cd799439017', {
        team: TEAM_ID,
        user: USER_ID,
        role: '507f1f77bcf86cd799439018',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
    });
};

test('GetPublicCanvasBootstrapUseCase: allows guest access to public trajectories as read-only', async () => {
    const useCase = new GetPublicCanvasBootstrapUseCase(
        createTrajectoryRepository(createTrajectory(true)),
        createTeamMemberRepository(null)
    );

    const result = await useCase.execute({ trajectoryId: TRAJECTORY_ID });

    assert.ok(result.success, 'Expected public trajectory to be accessible to guests');
    assert.equal(result.value.access.mode, PublicCanvasAccessMode.ReadOnly);
    assert.equal(result.value.access.isGuest, true);
    assert.equal(result.value.access.isPublic, true);
    assert.equal(result.value.access.hasTeamMembership, false);
    assert.equal(result.value.trajectory._id, TRAJECTORY_ID);
    assert.equal(result.value.trajectory.teamId, TEAM_ID);
    assert.deepEqual(result.value.trajectory.analysisIds, ['507f1f77bcf86cd799439016']);
});

test('GetPublicCanvasBootstrapUseCase: allows members to access private trajectories as read-only', async () => {
    const useCase = new GetPublicCanvasBootstrapUseCase(
        createTrajectoryRepository(createTrajectory(false)),
        createTeamMemberRepository(createTeamMember())
    );

    const result = await useCase.execute({
        trajectoryId: TRAJECTORY_ID,
        userId: USER_ID
    });

    assert.ok(result.success, 'Expected team members to access private trajectories');
    assert.equal(result.value.access.mode, PublicCanvasAccessMode.ReadOnly);
    assert.equal(result.value.access.isGuest, false);
    assert.equal(result.value.access.isPublic, false);
    assert.equal(result.value.access.hasTeamMembership, true);
});

test('GetPublicCanvasBootstrapUseCase: denies private trajectories without team membership', async () => {
    const useCase = new GetPublicCanvasBootstrapUseCase(
        createTrajectoryRepository(createTrajectory(false)),
        createTeamMemberRepository(null)
    );

    const result = await useCase.execute({
        trajectoryId: TRAJECTORY_ID,
        userId: USER_ID
    });

    assert.ok(!result.success, 'Expected private trajectory access without membership to fail');
    assert.equal(result.error.code, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN);
    assert.equal(result.error.statusCode, 403);
});

test('GetPublicCanvasBootstrapUseCase: returns not found for missing trajectories', async () => {
    const useCase = new GetPublicCanvasBootstrapUseCase(
        createTrajectoryRepository(null),
        createTeamMemberRepository(null)
    );

    const result = await useCase.execute({ trajectoryId: TRAJECTORY_ID });

    assert.ok(!result.success, 'Expected missing trajectories to fail');
    assert.equal(result.error.code, ErrorCodes.TRAJECTORY_NOT_FOUND);
    assert.equal(result.error.statusCode, 404);
});
