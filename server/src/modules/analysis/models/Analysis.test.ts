import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { AnalysisArtifactStatus, AnalysisStatus } from '@modules/analysis/contracts/domain/analysis';
import type {
    AnalysisChildAnalysis,
    AnalysisExpectedArtifact,
    AnalysisStage
} from '@shared/contracts/types/AnalysisProps';

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

const EXPECTED_ARTIFACTS: AnalysisExpectedArtifact[] = [{
    exposureId: 'rdf',
    name: 'RDF',
    pluginId: 'plugin-1',
    exporter: 'csv',
    exportType: 'table',
    status: 'pending',
    isPrimary: true,
    objectName: 'analysis/rdf.csv'
}];

const STAGES: AnalysisStage[] = [{
    stageKey: 'entrypoint',
    label: 'Entrypoint',
    type: 'entrypoint',
    status: 'completed',
    timestep: 0,
    pluginId: 'plugin-1',
    pluginDisplayName: 'Radial Distribution',
    nodeId: 'node-1',
    exposureId: 'rdf',
    configHash: 'hash-1',
    cacheHit: false,
    detail: 'done',
    durationMs: 120
}];

const CHILD_ANALYSES: AnalysisChildAnalysis[] = [{
    id: 'child-1',
    pluginId: 'plugin-2',
    pluginDisplayName: 'Coordination Number',
    configHash: 'hash-2',
    timestep: 3,
    status: 'cached',
    cacheHit: true,
    durationMs: 8
}];

describe('Analysis model', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([
            Analysis,
            Plugin,
            Trajectory,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name,
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: `cluster-${name}`,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const trajectory = await Trajectory.create({
            name: `traj-${name}`,
            team: team.id,
            createdBy: owner.id,
            storageClusterId: cluster.id,
            folder: null
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: {
                nodes: [],
                edges: []
            }
        }).save();

        return {
            team,
            owner,
            cluster,
            trajectory,
            plugin
        };
    };

    const seedAnalysis = async (fixture: TeamFixture, overrides: Partial<Analysis> = {}): Promise<Analysis> => {
        const analysis = await Analysis.create({
            team: fixture.team.id,
            trajectory: fixture.trajectory.id,
            plugin: fixture.plugin.id,
            pluginDisplayName: 'Radial Distribution',
            config: {},
            createdBy: fixture.owner.id,
            computeClusterId: fixture.cluster.id,
            storageClusterId: fixture.cluster.id,
            ...overrides
        }).save();

        return Analysis.findOneByOrFail({ id: analysis.id });
    };

    it('round-trips the expected artifacts untouched', async () => {
        const fixture = await createTeamFixture('one');

        const reloaded = await seedAnalysis(fixture, { expectedArtifacts: EXPECTED_ARTIFACTS });

        assert.deepEqual(reloaded.expectedArtifacts, EXPECTED_ARTIFACTS);
    });

    it('round-trips the stages untouched', async () => {
        const fixture = await createTeamFixture('one');

        const reloaded = await seedAnalysis(fixture, { stages: STAGES });

        assert.deepEqual(reloaded.stages, STAGES);
    });

    it('round-trips the child analyses untouched', async () => {
        const fixture = await createTeamFixture('one');

        const reloaded = await seedAnalysis(fixture, { childAnalyses: CHILD_ANALYSES });

        assert.deepEqual(reloaded.childAnalyses, CHILD_ANALYSES);
    });

    it('does not add a synthetic _id to the stored subdocuments', async () => {
        const fixture = await createTeamFixture('one');

        const reloaded = await seedAnalysis(fixture, {
            expectedArtifacts: EXPECTED_ARTIFACTS,
            stages: STAGES,
            childAnalyses: CHILD_ANALYSES
        });

        assert.deepEqual(Object.keys(reloaded.expectedArtifacts[0]), Object.keys(EXPECTED_ARTIFACTS[0]));
        assert.deepEqual(Object.keys(reloaded.stages[0]), Object.keys(STAGES[0]));
        assert.deepEqual(Object.keys(reloaded.childAnalyses[0]), Object.keys(CHILD_ANALYSES[0]));
        assert.equal(Object.prototype.hasOwnProperty.call(reloaded.expectedArtifacts[0], '_id'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(reloaded.stages[0], '_id'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(reloaded.childAnalyses[0], '_id'), false);
    });

    it('reads back a date inside a subdocument as an ISO string', async () => {
        const fixture = await createTeamFixture('one');
        const readyAt = new Date('2024-05-04T03:02:01.000Z');

        const reloaded = await seedAnalysis(fixture, {
            expectedArtifacts: [{
                exposureId: 'rdf',
                name: 'RDF',
                status: 'ready',
                readyAt
            }]
        });

        assert.equal(
            reloaded.expectedArtifacts[0].readyAt as unknown as string,
            readyAt.toISOString()
        );
    });

    it('drops the undefined keys of a subdocument', async () => {
        const fixture = await createTeamFixture('one');

        const reloaded = await seedAnalysis(fixture, {
            stages: [{
                stageKey: 'entrypoint',
                label: 'Entrypoint',
                type: 'entrypoint',
                status: 'pending',
                detail: undefined,
                nodeId: undefined
            }]
        });

        assert.deepEqual(Object.keys(reloaded.stages[0]), ['stageKey', 'label', 'type', 'status']);
    });

    it('defaults the json collections to empty arrays', async () => {
        const fixture = await createTeamFixture('one');

        const reloaded = await seedAnalysis(fixture);

        assert.deepEqual(reloaded.expectedArtifacts, []);
        assert.deepEqual(reloaded.stages, []);
        assert.deepEqual(reloaded.childAnalyses, []);
    });

    it('preserves an empty array instead of collapsing it to null', async () => {
        const fixture = await createTeamFixture('one');

        const reloaded = await seedAnalysis(fixture, {
            expectedArtifacts: [],
            stages: [],
            childAnalyses: []
        });

        assert.deepEqual(reloaded.expectedArtifacts, []);
        assert.deepEqual(reloaded.stages, []);
        assert.deepEqual(reloaded.childAnalyses, []);
    });

    it('starts pending on both status columns', async () => {
        const fixture = await createTeamFixture('one');

        const reloaded = await seedAnalysis(fixture);

        assert.equal(reloaded.status, AnalysisStatus.Pending);
        assert.equal(reloaded.artifactStatus, AnalysisArtifactStatus.Pending);
    });

    it('round-trips a nested config object of arbitrary depth', async () => {
        const fixture = await createTeamFixture('one');
        const config = {
            cutoff: 6.5,
            bins: [1, 2, 3],
            nested: {
                enabled: true,
                labels: ['a', 'b']
            }
        };

        const reloaded = await seedAnalysis(fixture, { config });

        assert.deepEqual(reloaded.config, config);
    });

    it('deletes the analyses of a trajectory removed by the database cascade', async () => {
        const fixture = await createTeamFixture('one');
        await seedAnalysis(fixture);

        await Trajectory.delete({ id: fixture.trajectory.id });

        assert.equal(await Analysis.countBy({ team: fixture.team.id }), 0);
    });
});
