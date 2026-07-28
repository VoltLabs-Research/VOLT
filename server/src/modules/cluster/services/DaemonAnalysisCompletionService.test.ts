import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Plugin from '@modules/plugin/models/Plugin';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { DaemonAnalysisCompletionService } from '@modules/cluster/services/DaemonAnalysisCompletionService';
import { AnalysisArtifactStatus, AnalysisStatus } from '@modules/analysis/contracts/domain/analysis';
import { JobStatus } from '@shared/contracts/types';
import ApplicationError from '@shared/application/errors/ApplicationError';

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
    cluster: TeamCluster;
    otherCluster: TeamCluster;
    trajectory: Trajectory;
    analysis: Analysis;
}

interface ServiceInternals{
    findAnalysisById(analysisId: string): Promise<{ _id: string; props: Record<string, unknown> } | null>;
    updateAnalysisById(analysisId: string, data: Record<string, unknown>): Promise<{ _id: string; props: Record<string, unknown> } | null>;
    findTrajectoryById(trajectoryId: string): Promise<{ _id: string; props: Record<string, unknown> } | null>;
    resolveAnalysisOwnership(input: {
        teamClusterId: string;
        analysisId: string;
        teamId: string;
        trajectoryId?: string;
        timestep?: number;
    }): Promise<{ teamId: string; trajectory: { _id: string } }>;
    resolveTrajectoryOwnership(input: {
        teamClusterId: string;
        trajectoryId: string;
        teamId: string;
        timestep?: number;
    }): Promise<{ teamId: string; trajectory: { _id: string } }>;
}

describe('DaemonAnalysisCompletionService', () => {
    let dataSource: DataSource;
    const service = new DaemonAnalysisCompletionService();
    const internals = service as unknown as ServiceInternals;

    before(async () => {
        dataSource = await createHarness([
            Analysis,
            Trajectory,
            Plugin,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createCluster = async (team: Team, owner: User, name: string): Promise<TeamCluster> => {
        return TeamCluster.create({
            name,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
    };

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const otherTeam = await Team.create({
            name: 'Team Two',
            owner: owner.id
        }).save();
        const cluster = await createCluster(team, owner, 'compute');
        const otherCluster = await createCluster(team, owner, 'other');
        const trajectory = await Trajectory.create({
            name: 'traj',
            team: team.id,
            createdBy: owner.id,
            storageClusterId: cluster.id,
            folder: null,
            stats: {
                totalFiles: 0,
                totalSize: 0
            }
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: {}
        }).save();
        const analysis = await Analysis.create({
            team: team.id,
            trajectory: trajectory.id,
            createdBy: owner.id,
            plugin: plugin.id,
            pluginDisplayName: 'plug',
            config: {},
            storageClusterId: cluster.id,
            computeClusterId: cluster.id
        }).save();

        return {
            team,
            otherTeam,
            owner,
            cluster,
            otherCluster,
            trajectory,
            analysis
        };
    };

    it('reads an analysis back into the domain shape', async () => {
        const fixture = await createFixture();

        const analysis = await internals.findAnalysisById(fixture.analysis.id);

        assert.equal(analysis?._id, fixture.analysis.id);
        assert.equal(analysis?.props.team, fixture.team.id);
        assert.equal(analysis?.props.trajectory, fixture.trajectory.id);
        assert.equal(analysis?.props.computeClusterId, fixture.cluster.id);
        assert.equal(analysis?.props.status, AnalysisStatus.Pending);
        assert.deepEqual(analysis?.props.expectedArtifacts, []);
    });

    it('returns null for a missing analysis', async () => {
        await createFixture();

        assert.equal(await internals.findAnalysisById('missing-analysis'), null);
    });

    it('reads a trajectory back into the domain shape', async () => {
        const fixture = await createFixture();

        const trajectory = await internals.findTrajectoryById(fixture.trajectory.id);

        assert.equal(trajectory?._id, fixture.trajectory.id);
        assert.equal(trajectory?.props.name, 'traj');
        assert.equal(trajectory?.props.hasPreview, false);
    });

    it('persists an analysis patch and leaves untouched fields alone', async () => {
        const fixture = await createFixture();
        const finishedAt = new Date('2024-05-01T00:00:00.000Z');

        const updated = await internals.updateAnalysisById(fixture.analysis.id, {
            status: AnalysisStatus.Completed,
            finishedAt,
            stages: [{
                stageKey: 'stage-one',
                label: 'Stage One',
                type: 'system',
                status: 'completed'
            }]
        });

        assert.equal(updated?.props.status, AnalysisStatus.Completed);

        const reloaded = await Analysis.findOneBy({ id: fixture.analysis.id });
        assert.equal(reloaded?.status, AnalysisStatus.Completed);
        assert.equal(reloaded?.finishedAt?.getTime(), finishedAt.getTime());
        assert.equal(reloaded?.stages.length, 1);
        assert.equal(reloaded?.artifactStatus, AnalysisArtifactStatus.Pending);
        assert.equal(reloaded?.computeClusterId, fixture.cluster.id);
    });

    it('returns null when patching a missing analysis', async () => {
        await createFixture();

        assert.equal(await internals.updateAnalysisById('missing-analysis', { status: AnalysisStatus.Failed }), null);
    });

    it('resolves analysis ownership for the owning compute cluster', async () => {
        const fixture = await createFixture();

        const resolved = await internals.resolveAnalysisOwnership({
            teamClusterId: fixture.cluster.id,
            analysisId: fixture.analysis.id,
            teamId: fixture.team.id,
            trajectoryId: fixture.trajectory.id,
            timestep: 4
        });

        assert.equal(resolved.teamId, fixture.team.id);
        assert.equal(resolved.trajectory._id, fixture.trajectory.id);
    });

    it('rejects analysis ownership for a missing analysis', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => internals.resolveAnalysisOwnership({
                teamClusterId: fixture.cluster.id,
                analysisId: 'missing-analysis',
                teamId: fixture.team.id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TEAM_CLUSTER_DAEMON_ANALYSIS_NOT_FOUND');
                return true;
            }
        );
    });

    it('rejects analysis ownership for a foreign team', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => internals.resolveAnalysisOwnership({
                teamClusterId: fixture.cluster.id,
                analysisId: fixture.analysis.id,
                teamId: fixture.otherTeam.id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH');
                return true;
            }
        );
    });

    it('rejects analysis ownership reported by a foreign compute cluster', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => internals.resolveAnalysisOwnership({
                teamClusterId: fixture.otherCluster.id,
                analysisId: fixture.analysis.id,
                teamId: fixture.team.id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH');
                return true;
            }
        );
    });

    it('rejects analysis ownership when the payload trajectory does not match', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => internals.resolveAnalysisOwnership({
                teamClusterId: fixture.cluster.id,
                analysisId: fixture.analysis.id,
                teamId: fixture.team.id,
                trajectoryId: 'another-trajectory'
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH');
                return true;
            }
        );
    });

    it('resolves trajectory ownership', async () => {
        const fixture = await createFixture();

        const resolved = await internals.resolveTrajectoryOwnership({
            teamClusterId: fixture.cluster.id,
            trajectoryId: fixture.trajectory.id,
            teamId: fixture.team.id
        });

        assert.equal(resolved.trajectory._id, fixture.trajectory.id);
    });

    it('rejects trajectory ownership for a missing trajectory', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => internals.resolveTrajectoryOwnership({
                teamClusterId: fixture.cluster.id,
                trajectoryId: 'missing-trajectory',
                teamId: fixture.team.id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND');
                return true;
            }
        );
    });

    it('rejects trajectory ownership for a foreign team', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => internals.resolveTrajectoryOwnership({
                teamClusterId: fixture.cluster.id,
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.otherTeam.id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TEAM_CLUSTER_DAEMON_TRAJECTORY_TEAM_MISMATCH');
                return true;
            }
        );
    });

    it('rejects an artifact upload status update for a foreign team', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => service.handleArtifactUploadJobStatus({
                teamClusterId: fixture.cluster.id,
                jobId: 'artifact-upload-1',
                analysisId: fixture.analysis.id,
                teamId: fixture.otherTeam.id,
                trajectoryId: fixture.trajectory.id,
                status: JobStatus.Completed
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH');
                return true;
            }
        );
    });
});
