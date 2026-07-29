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
import {
    buildAnalysisRelationOptions,
    findByTeamAndSearch,
    findRuntimeTargetsByTrajectoryId,
    toAnalysisLike
} from '@modules/analysis/services/AnalysisQueries';
import { AnalysisRelation } from '@modules/analysis/contracts/domain/analysis';

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    otherCluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

const A_TWELVE_CHARACTER_SEARCH = 'abcdefghijkl';
const AN_ENTITY_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6';

describe('AnalysisQueries', () => {
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

    const createUser = (email: string): Promise<User> => User.create({
        email,
        firstName: 'ada',
        lastName: 'lovelace'
    }).save();

    const createCluster = (team: Team, owner: User, name: string): Promise<TeamCluster> => TeamCluster.create({
        name,
        team: team.id,
        createdBy: owner.id,
        services: {},
        queueConcurrency: {},
        queueScopeLimits: {},
        roleConfig: {}
    }).save();

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await createUser(`owner-${name}@volt.test`);
        const team = await Team.create({
            name,
            owner: owner.id
        }).save();
        const cluster = await createCluster(team, owner, `compute-${name}`);
        const otherCluster = await createCluster(team, owner, `storage-${name}`);
        const trajectory = await Trajectory.create({
            name: `Water Box ${name}`,
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
            otherCluster,
            trajectory,
            plugin
        };
    };

    const seedAnalysis = (fixture: TeamFixture, overrides: Partial<Analysis> = {}): Promise<Analysis> => Analysis.create({
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        config: {},
        createdBy: fixture.owner.id,
        computeClusterId: fixture.cluster.id,
        storageClusterId: fixture.otherCluster.id,
        ...overrides
    }).save();

    describe('findByTeamAndSearch', () => {
        it('matches the plugin display name case insensitively', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture, { pluginDisplayName: 'Radial Distribution' });
            await seedAnalysis(fixture, { pluginDisplayName: 'Coordination Number' });

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial'
            });

            assert.equal(result.total, 1);
            assert.equal(result.data[0].props.pluginDisplayName, 'Radial Distribution');
        });

        it('matches the analyses of the trajectories given as candidate ids', async () => {
            const fixture = await createTeamFixture('one');
            const other = await Trajectory.create({
                name: 'Other Box',
                team: fixture.team.id,
                createdBy: fixture.owner.id,
                storageClusterId: fixture.cluster.id,
                folder: null
            }).save();

            await seedAnalysis(fixture, { pluginDisplayName: 'Coordination Number' });
            const expected = await seedAnalysis(fixture, {
                pluginDisplayName: 'Coordination Number',
                trajectory: other.id
            });

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'other',
                trajectoryIds: [other.id]
            });

            assert.deepEqual(result.data.map((analysis) => analysis._id), [expected.id]);
        });

        it('matches an exact analysis id when the search is an entity id', async () => {
            const fixture = await createTeamFixture('one');
            const target = await seedAnalysis(fixture, {
                id: AN_ENTITY_ID,
                pluginDisplayName: 'Coordination Number'
            });
            await seedAnalysis(fixture, { pluginDisplayName: 'Coordination Number' });

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: AN_ENTITY_ID
            });

            assert.deepEqual(result.data.map((analysis) => analysis._id), [target.id]);
        });

        it('does not treat a twelve character search as an analysis id', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture, {
                id: A_TWELVE_CHARACTER_SEARCH,
                pluginDisplayName: 'Coordination Number'
            });

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: A_TWELVE_CHARACTER_SEARCH
            });

            assert.equal(result.total, 0);
            assert.deepEqual(result.data, []);
        });

        it('combines the three search branches into a single result set', async () => {
            const fixture = await createTeamFixture('one');
            const other = await Trajectory.create({
                name: 'Other Box',
                team: fixture.team.id,
                createdBy: fixture.owner.id,
                storageClusterId: fixture.cluster.id,
                folder: null
            }).save();

            const byName = await seedAnalysis(fixture, { pluginDisplayName: `Radial ${AN_ENTITY_ID}` });
            const byTrajectory = await seedAnalysis(fixture, {
                pluginDisplayName: 'Coordination Number',
                trajectory: other.id
            });
            const byId = await seedAnalysis(fixture, {
                id: AN_ENTITY_ID,
                pluginDisplayName: 'Coordination Number'
            });

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: AN_ENTITY_ID,
                trajectoryIds: [other.id]
            });

            assert.deepEqual(
                result.data.map((analysis) => analysis._id).sort(),
                [byName.id, byTrajectory.id, byId.id].sort()
            );
        });

        it('never leaks the analyses of another team through any branch', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');

            await seedAnalysis(otherFixture, { id: AN_ENTITY_ID });

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: AN_ENTITY_ID,
                trajectoryIds: [otherFixture.trajectory.id]
            });

            assert.equal(result.total, 0);
        });

        it('returns the newest analyses first', async () => {
            const fixture = await createTeamFixture('one');
            const older = await seedAnalysis(fixture);
            const newer = await seedAnalysis(fixture);

            await Analysis.update({ id: older.id }, { createdAt: new Date('2024-01-01T00:00:00.000Z') });
            await Analysis.update({ id: newer.id }, { createdAt: new Date('2024-06-01T00:00:00.000Z') });

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial'
            });

            assert.deepEqual(result.data.map((analysis) => analysis._id), [newer.id, older.id]);
        });

        it('defaults the search page size to twenty', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial'
            });

            assert.equal(result.page, 1);
            assert.equal(result.limit, 20);
            assert.equal(result.totalPages, 1);
        });

        it('reports the page metadata of the requested page', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);
            await seedAnalysis(fixture);
            await seedAnalysis(fixture);

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial',
                page: 2,
                limit: 2
            });

            assert.equal(result.total, 3);
            assert.equal(result.page, 2);
            assert.equal(result.limit, 2);
            assert.equal(result.totalPages, 2);
            assert.equal(result.data.length, 1);
        });

        it('caps the requested page size at five hundred', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial',
                limit: 100000
            });

            assert.equal(result.limit, 500);
        });
    });

    describe('buildAnalysisRelationOptions', () => {
        it('asks for nothing when no relation is requested', () => {
            assert.deepEqual(buildAnalysisRelationOptions(), {});
            assert.deepEqual(buildAnalysisRelationOptions([]), {});
        });

        it('narrows only the relations that declare a projection', () => {
            const options = buildAnalysisRelationOptions([AnalysisRelation.Plugin, AnalysisRelation.Trajectory]);

            assert.deepEqual(options.relations, {
                pluginRef: true,
                trajectoryRef: true
            });
            assert.deepEqual(options.select, {
                trajectoryRef: {
                    id: true,
                    name: true
                }
            });
        });

        it('omits the select clause when every requested relation is unprojected', () => {
            const options = buildAnalysisRelationOptions([AnalysisRelation.Plugin, AnalysisRelation.Team]);

            assert.equal(Object.prototype.hasOwnProperty.call(options, 'select'), false);
        });
    });

    describe('toAnalysisLike', () => {
        it('projects only the name of a loaded trajectory', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial',
                relations: [AnalysisRelation.Trajectory]
            });

            assert.deepEqual(result.data[0].props.trajectory, {
                _id: fixture.trajectory.id,
                name: fixture.trajectory.name
            });
        });

        it('projects only the identity fields of a loaded author', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial',
                relations: [AnalysisRelation.CreatedBy]
            });

            assert.deepEqual(result.data[0].props.createdBy, {
                _id: fixture.owner.id,
                firstName: 'ada',
                lastName: 'lovelace',
                email: 'owner-one@volt.test',
                avatar: null
            });
        });

        it('projects only the name of the loaded compute and storage clusters', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial',
                relations: [AnalysisRelation.ComputeCluster, AnalysisRelation.StorageCluster]
            });

            assert.deepEqual(result.data[0].props.computeClusterId, {
                _id: fixture.cluster.id,
                name: fixture.cluster.name
            });
            assert.deepEqual(result.data[0].props.storageClusterId, {
                _id: fixture.otherCluster.id,
                name: fixture.otherCluster.name
            });
        });

        it('emits an unloaded relation as its plain id string', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial',
                relations: [AnalysisRelation.Trajectory]
            });
            const props = result.data[0].props;

            assert.equal(props.createdBy, fixture.owner.id);
            assert.equal(props.plugin, fixture.plugin.id);
            assert.equal(props.team, fixture.team.id);
            assert.equal(props.computeClusterId, fixture.cluster.id);
            assert.equal(props.storageClusterId, fixture.otherCluster.id);
        });

        it('emits every relation as an id string when none is loaded', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await findByTeamAndSearch({
                teamId: fixture.team.id,
                search: 'radial'
            });
            const props = result.data[0].props;

            assert.equal(props.trajectory, fixture.trajectory.id);
            assert.equal(props.createdBy, fixture.owner.id);
            assert.equal(props.plugin, fixture.plugin.id);
            assert.equal(props.team, fixture.team.id);
        });

        it('exposes the identifier as _id and never as id', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            const reloaded = await Analysis.findOneByOrFail({ id: analysis.id });
            const mapped = toAnalysisLike(reloaded);

            assert.equal(mapped._id, analysis.id);
            assert.equal(Object.prototype.hasOwnProperty.call(mapped.props, 'id'), false);
            assert.equal(Object.prototype.hasOwnProperty.call(mapped.props, '_id'), false);
        });
    });

    describe('findRuntimeTargetsByTrajectoryId', () => {
        it('returns the compute cluster of every analysis of the trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            const targets = await findRuntimeTargetsByTrajectoryId(fixture.trajectory.id);

            assert.deepEqual(targets, [{
                analysisId: analysis.id,
                computeClusterId: fixture.cluster.id
            }]);
        });

        it('reports an undefined compute cluster when the analysis has none', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture, { computeClusterId: null });

            const targets = await findRuntimeTargetsByTrajectoryId(fixture.trajectory.id);

            assert.deepEqual(targets, [{
                analysisId: analysis.id,
                computeClusterId: undefined
            }]);
        });

        it('returns an empty list for an unknown trajectory id', async () => {
            await createTeamFixture('one');

            assert.deepEqual(await findRuntimeTargetsByTrajectoryId('not-a-trajectory-id'), []);
        });
    });
});
